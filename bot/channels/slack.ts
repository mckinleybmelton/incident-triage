import { slackChannel } from "@grok/agent-sdk/channels/slack";

/**
 * Socket Mode Slack channel for interactive follow-ups.
 * Run `npx @grok/agent-sdk slack create --dir . --name "Incident Triage" --prefix INCIDENT_TRIAGE`
 * to mint tokens into .env.local (requires agent-sdk login).
 */
export default slackChannel({
  envPrefix: "INCIDENT_TRIAGE",
  suggestedPrompts: [
    {
      title: "Re-triage last alert",
      message:
        "Re-triage the most recent Alertmanager firing alert using Loki and recent commits, then summarize.",
    },
    {
      title: "What changed last hour?",
      message:
        "What commits or deploys landed in the last hour that could relate to the current incident?",
    },
  ],
});
