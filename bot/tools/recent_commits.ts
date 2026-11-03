import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";

const execFileAsync = promisify(execFile);
const MAX_COMMITS = 15;

export default defineTool({
  description:
    "List recent commits for deploy correlation. Uses GIT_REPO_PATH locally, or GITHUB_TOKEN + GITHUB_REPO on hosting.",
  effect: "read",
  inputSchema: z.object({
    sinceHours: z.number().positive().max(168).optional(),
    path: z
      .string()
      .optional()
      .describe("Override GIT_REPO_PATH for a local clone."),
    repo: z
      .string()
      .optional()
      .describe("Override GITHUB_REPO (owner/name) for the GitHub API."),
  }),
  async execute(input) {
    const sinceHours = input.sinceHours ?? 2;
    const since = new Date(Date.now() - sinceHours * 3600_000).toISOString();

    const localPath = input.path ?? process.env.GIT_REPO_PATH;
    if (localPath) {
      try {
        const { stdout } = await execFileAsync(
          "git",
          [
            "-C",
            localPath,
            "log",
            `--since=${since}`,
            `-n`,
            String(MAX_COMMITS),
            "--pretty=format:%h %ad %an %s",
            "--date=iso-strict",
          ],
          { timeout: 15_000, maxBuffer: 256_000 },
        );
        const commits = stdout
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
        return {
          ok: true,
          source: "git",
          path: localPath,
          since,
          commits,
        };
      } catch (err) {
        return {
          ok: false,
          source: "git",
          reason: "git log failed",
          detail: err instanceof Error ? err.message : String(err),
          commits: [] as string[],
        };
      }
    }

    const repo = input.repo ?? process.env.GITHUB_REPO;
    const token = process.env.GITHUB_TOKEN;
    if (repo && token) {
      try {
        const url = new URL(`https://api.github.com/repos/${repo}/commits`);
        url.searchParams.set("since", since);
        url.searchParams.set("per_page", String(MAX_COMMITS));
        const res = await fetch(url, {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "User-Agent": "incident-triage-agent",
          },
        });
        if (!res.ok) {
          return {
            ok: false,
            source: "github",
            reason: `GitHub HTTP ${res.status}`,
            detail: (await res.text()).slice(0, 500),
            commits: [] as string[],
          };
        }
        const data = (await res.json()) as Array<{
          sha: string;
          commit?: {
            message?: string;
            author?: { name?: string; date?: string };
          };
        }>;
        const commits = data.map((c) => {
          const sha = c.sha.slice(0, 7);
          const msg = (c.commit?.message ?? "").split("\n")[0];
          const who = c.commit?.author?.name ?? "?";
          const when = c.commit?.author?.date ?? "?";
          return `${sha} ${when} ${who} ${msg}`;
        });
        return {
          ok: true,
          source: "github",
          repo,
          since,
          commits,
        };
      } catch (err) {
        return {
          ok: false,
          source: "github",
          reason: "GitHub fetch failed",
          detail: err instanceof Error ? err.message : String(err),
          commits: [] as string[],
        };
      }
    }

    return {
      ok: false,
      reason: "No git source configured",
      hint: "Set GIT_REPO_PATH for local clones, or GITHUB_TOKEN and GITHUB_REPO (owner/name).",
      since,
      commits: [] as string[],
    };
  },
});
