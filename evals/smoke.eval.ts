import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineEval, includes } from "@grok/agent-sdk/evals";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const alertJson = readFileSync(
  join(root, "fixtures/alertmanager/firing.json"),
  "utf8",
);

export default defineEval({
  tags: ["smoke"],
  description:
    "Triage a fixture Alertmanager firing alert with Loki + commits tools.",
  cases: [
    {
      id: "firing-payments",
      description: "HighErrorRate on payments-api",
      async test(t) {
        await t.send(
          [
            "Triage this Alertmanager webhook.",
            "Read alert.json, call query_loki and recent_commits, then post_slack_triage once.",
            'groupKey={}:{alertname="HighErrorRate"}:{service="payments-api"}',
            "status=firing",
            "alertname=HighErrorRate",
            "service=payments-api",
            "namespace=prod",
            "severity=critical",
            "summary=Elevated 5xx rate on payments-api",
            "startsAt=2026-11-03T15:42:00.000Z",
          ].join("\n"),
          {
            workspaceFiles: {
              "alert.json": alertJson,
            },
          },
        );
        t.succeeded();
        t.calledTool("query_loki");
        t.calledTool("recent_commits");
        t.calledTool("post_slack_triage");
        t.check(t.reply, includes(/what broke|severity|matter/i));
      },
    },
  ],
});
