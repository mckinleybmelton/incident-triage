import {
  defineChannel,
  localDev,
  POST,
  sharedSecretAuth,
} from "@grok/agent-sdk/channels";
import * as z from "zod/v4";
import {
  alertmanagerWebhookSchema,
  summarizeAlert,
} from "../lib/alertmanager.js";

type AlertChannelState = {
  groupKey: string;
  status: string;
};

export default defineChannel<AlertChannelState>({
  auth: [
    sharedSecretAuth({
      header: "Authorization",
      secret: "INCIDENT_TRIAGE_WEBHOOK_SECRET",
    }),
    localDev(),
  ],
  state: { groupKey: "", status: "" },
  routes: [
    POST("/", {
      description: "Prometheus Alertmanager webhook (v4 JSON)",
      bodySchema: z.unknown(),
      handler: async (_request, { send, waitUntil, body }) => {
        const parsed = alertmanagerWebhookSchema.safeParse(body);
        const payload = parsed.success ? parsed.data : {};
        const summary = summarizeAlert(payload);
        const alertJson = JSON.stringify(body, null, 2);

        const prompt = [
          "Triage this Alertmanager webhook.",
          "Read alert.json, call query_loki and recent_commits, then post_slack_triage once.",
          `groupKey=${summary.groupKey}`,
          `status=${summary.status}`,
          `alertname=${summary.alertname}`,
          `service=${summary.service}`,
          `namespace=${summary.namespace}`,
          `severity=${summary.severity}`,
          `summary=${summary.summary}`,
          summary.startsAt ? `startsAt=${summary.startsAt}` : "",
        ]
          .filter(Boolean)
          .join("\n");

        waitUntil(
          send(prompt, {
            continuationToken: `alertmanager:${summary.groupKey}`,
            title: `Alert ${summary.alertname} (${summary.status})`,
            state: {
              groupKey: summary.groupKey,
              status: summary.status,
            },
            workspaceFiles: {
              "alert.json": alertJson ?? "null",
            },
          }),
        );

        return new Response(null, { status: 202 });
      },
    }),
  ],
});
