import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";

type DedupeRecord = {
  postedAt: string;
  channel: string;
  groupKey: string;
  status: string;
  ts?: string;
};

function isMissingSlackCredentials(detail: string): boolean {
  return /No Slack bot token|SLACK_[A-Z0-9_]*TOKEN|missing credentials|set INCIDENT_TRIAGE_SLACK/i.test(
    detail,
  );
}

export default defineTool({
  description:
    "Post an incident triage summary to Slack. Idempotent per groupKey+status via host kv (so firing and resolved can both post).",
  effect: "idempotent",
  inputSchema: z.object({
    groupKey: z.string().describe("Alertmanager groupKey used for dedupe."),
    status: z
      .string()
      .describe(
        "Alertmanager status for this delivery (e.g. firing or resolved). Included in the dedupe key.",
      ),
    text: z.string().describe("Triage summary markdown/plain text for Slack."),
    channel: z
      .string()
      .optional()
      .describe("Override SLACK_TRIAGE_CHANNEL (#name or C…)."),
  }),
  async execute({ groupKey, status, text, channel }, ctx) {
    const dest = channel ?? process.env.SLACK_TRIAGE_CHANNEL;
    if (!dest) {
      return {
        ok: false,
        reason: "SLACK_TRIAGE_CHANNEL unset",
        hint: "Set SLACK_TRIAGE_CHANNEL to a channel id or #name.",
      };
    }

    const normalizedStatus = status.trim().toLowerCase() || "unknown";
    const dedupeKey = `slack-triage:${groupKey}:${normalizedStatus}`;
    const existing = (await ctx.host.kv.get(dedupeKey)) as
      | DedupeRecord
      | undefined;
    if (existing && typeof existing === "object" && existing.postedAt) {
      return {
        ok: true,
        deduped: true,
        groupKey,
        status: normalizedStatus,
        channel: existing.channel,
        ts: existing.ts,
        postedAt: existing.postedAt,
      };
    }

    try {
      const client = await ctx.host.slack.getClient();
      const result = await client.chat.postMessage({
        channel: dest,
        text,
        mrkdwn: true,
      });
      const record: DedupeRecord = {
        postedAt: new Date().toISOString(),
        channel: dest,
        groupKey,
        status: normalizedStatus,
        ts: typeof result.ts === "string" ? result.ts : undefined,
      };
      await ctx.host.kv.put(dedupeKey, record);
      return {
        ok: true,
        deduped: false,
        groupKey,
        status: normalizedStatus,
        channel: dest,
        ts: record.ts,
      };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      if (isMissingSlackCredentials(detail)) {
        // Do not write kv — a later run with real credentials must still post.
        return {
          ok: false,
          dryRun: true,
          reason: "Slack credentials unavailable; nothing posted or deduped",
          detail,
          groupKey,
          status: normalizedStatus,
          channel: dest,
          textPreview: text.slice(0, 200),
        };
      }
      return {
        ok: false,
        reason: "Slack post failed",
        detail,
        groupKey,
        status: normalizedStatus,
        channel: dest,
      };
    }
  },
});
