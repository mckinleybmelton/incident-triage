import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";

type DedupeRecord = {
  postedAt: string;
  channel: string;
  ts?: string;
};

export default defineTool({
  description:
    "Post an incident triage summary to Slack. Idempotent per groupKey via host kv.",
  effect: "idempotent",
  inputSchema: z.object({
    groupKey: z.string().describe("Alertmanager groupKey used for dedupe."),
    text: z.string().describe("Triage summary markdown/plain text for Slack."),
    channel: z
      .string()
      .optional()
      .describe("Override SLACK_TRIAGE_CHANNEL (#name or C…)."),
  }),
  async execute({ groupKey, text, channel }, ctx) {
    const dest = channel ?? process.env.SLACK_TRIAGE_CHANNEL;
    if (!dest) {
      return {
        ok: false,
        reason: "SLACK_TRIAGE_CHANNEL unset",
        hint: "Set SLACK_TRIAGE_CHANNEL to a channel id or #name.",
      };
    }

    const dedupeKey = `slack-triage:${groupKey}`;
    const existing = (await ctx.host.kv.get(dedupeKey)) as
      | DedupeRecord
      | undefined;
    if (existing && typeof existing === "object" && existing.postedAt) {
      return {
        ok: true,
        deduped: true,
        groupKey,
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
        ts: typeof result.ts === "string" ? result.ts : undefined,
      };
      await ctx.host.kv.put(dedupeKey, record);
      return {
        ok: true,
        deduped: false,
        groupKey,
        channel: dest,
        ts: record.ts,
      };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      const missingCreds =
        /SLACK_|token|credential|not configured|unavailable/i.test(detail);
      if (missingCreds) {
        const record: DedupeRecord = {
          postedAt: new Date().toISOString(),
          channel: dest,
          ts: "dry-run-no-slack",
        };
        await ctx.host.kv.put(dedupeKey, record);
        return {
          ok: true,
          dryRun: true,
          reason: "Slack credentials unavailable; recorded dedupe only",
          detail,
          groupKey,
          channel: dest,
          textPreview: text.slice(0, 200),
        };
      }
      return {
        ok: false,
        reason: "Slack post failed",
        detail,
        groupKey,
        channel: dest,
      };
    }
  },
});
