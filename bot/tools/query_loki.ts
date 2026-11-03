import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";

const MAX_LINES = 40;
const MAX_CHARS = 12_000;

export default defineTool({
  description:
    "Query Grafana Loki for logs around an alert. Prefer a LogQL query; otherwise pass service/namespace labels.",
  effect: "read",
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe("LogQL query. If omitted, built from service/namespace."),
    service: z.string().optional(),
    namespace: z.string().optional(),
    start: z
      .string()
      .optional()
      .describe("RFC3339 or unix ns start. Defaults to 15m before end."),
    end: z
      .string()
      .optional()
      .describe("RFC3339 or unix ns end. Defaults to now."),
    limit: z.number().int().positive().max(MAX_LINES).optional(),
  }),
  async execute(input) {
    const lokiUrl = process.env.LOKI_URL?.replace(/\/$/, "");
    if (!lokiUrl) {
      return {
        ok: false,
        reason: "LOKI_URL unset",
        hint: "Set LOKI_URL to your Loki base (e.g. https://loki.example.com). Returning empty evidence.",
        lines: [] as string[],
      };
    }

    const endMs = input.end ? Date.parse(input.end) || Date.now() : Date.now();
    const startMs = input.start
      ? Date.parse(input.start) || endMs - 15 * 60_000
      : endMs - 15 * 60_000;

    const query =
      input.query ??
      (input.service
        ? `{service="${input.service}"${
            input.namespace ? `,namespace="${input.namespace}"` : ""
          }} |= \`\``
        : '{job=~".+"} |= `error`');

    const limit = Math.min(input.limit ?? MAX_LINES, MAX_LINES);
    const params = new URLSearchParams({
      query,
      start: String(startMs * 1_000_000),
      end: String(endMs * 1_000_000),
      limit: String(limit),
      direction: "backward",
    });

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    const token = process.env.LOKI_TOKEN;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`${lokiUrl}/loki/api/v1/query_range?${params}`, {
        headers,
      });
      if (!res.ok) {
        const text = (await res.text()).slice(0, 500);
        return {
          ok: false,
          reason: `Loki HTTP ${res.status}`,
          detail: text,
          query,
          lines: [] as string[],
        };
      }

      const data = (await res.json()) as {
        data?: {
          result?: Array<{
            stream?: Record<string, string>;
            values?: Array<[string, string]>;
          }>;
        };
      };

      const lines: string[] = [];
      for (const stream of data.data?.result ?? []) {
        for (const [, line] of stream.values ?? []) {
          lines.push(line);
          if (lines.length >= limit) break;
        }
        if (lines.length >= limit) break;
      }

      let joined = lines.join("\n");
      if (joined.length > MAX_CHARS) {
        joined = joined.slice(0, MAX_CHARS) + "\n…truncated";
      }

      return {
        ok: true,
        query,
        start: new Date(startMs).toISOString(),
        end: new Date(endMs).toISOString(),
        lineCount: lines.length,
        lines: joined.split("\n"),
      };
    } catch (err) {
      return {
        ok: false,
        reason: "Loki fetch failed",
        detail: err instanceof Error ? err.message : String(err),
        query,
        lines: [] as string[],
      };
    }
  },
});
