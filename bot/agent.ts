import { defineAgent } from "@grok/agent-sdk";

export default defineAgent({
  model: {
    id: "grok-4.7",
    params: [
      { id: "reasoning_effort", value: "high" },
      { id: "fast", value: "true" },
    ],
  },
  hosting: {
    // Replace loki.example.com / api.github.com with your real hosts before deploy.
    egressDomains: ["slack.com", "api.github.com", "loki.example.com"],
    secretNames: [
      "INCIDENT_TRIAGE_WEBHOOK_SECRET",
      "INCIDENT_TRIAGE_SLACK_BOT_TOKEN",
      "INCIDENT_TRIAGE_SLACK_APP_TOKEN",
      "LOKI_URL",
      "LOKI_TOKEN",
      "GIT_REPO_PATH",
      "GITHUB_TOKEN",
      "GITHUB_REPO",
      "SLACK_TRIAGE_CHANNEL",
    ],
  },
});
