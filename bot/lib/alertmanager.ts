import * as z from "zod/v4";

const alertSchema = z.object({
  status: z.string().optional(),
  labels: z.record(z.string(), z.string()).optional(),
  annotations: z.record(z.string(), z.string()).optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  fingerprint: z.string().optional(),
});

export const alertmanagerWebhookSchema = z.object({
  version: z.string().optional(),
  groupKey: z.string().optional(),
  truncatedAlerts: z.number().optional(),
  status: z.string().optional(),
  receiver: z.string().optional(),
  groupLabels: z.record(z.string(), z.string()).optional(),
  commonLabels: z.record(z.string(), z.string()).optional(),
  commonAnnotations: z.record(z.string(), z.string()).optional(),
  externalURL: z.string().optional(),
  alerts: z.array(alertSchema).optional(),
});

export type AlertmanagerWebhook = z.infer<typeof alertmanagerWebhookSchema>;

export function summarizeAlert(body: AlertmanagerWebhook): {
  groupKey: string;
  status: string;
  alertname: string;
  service: string;
  namespace: string;
  severity: string;
  summary: string;
  startsAt: string | undefined;
} {
  const labels = body.commonLabels ?? body.groupLabels ?? {};
  const annotations = body.commonAnnotations ?? {};
  const first = body.alerts?.[0];
  return {
    groupKey: body.groupKey ?? first?.fingerprint ?? "unknown",
    status: body.status ?? first?.status ?? "unknown",
    alertname: labels.alertname ?? first?.labels?.alertname ?? "unknown",
    service: labels.service ?? first?.labels?.service ?? "unknown",
    namespace: labels.namespace ?? first?.labels?.namespace ?? "unknown",
    severity: labels.severity ?? first?.labels?.severity ?? "unknown",
    summary:
      annotations.summary ??
      first?.annotations?.summary ??
      annotations.description ??
      "no summary",
    startsAt: first?.startsAt,
  };
}
