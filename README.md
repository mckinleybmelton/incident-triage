# Incident triage (Agent SDK)

On-call engineers spend the first part of every incident figuring out what broke and whether it matters. This repo is an **Agent SDK** agent that:

1. Accepts Prometheus Alertmanager webhooks
2. Queries Grafana Loki for logs and Git for recent commits
3. Posts a short triage summary to Slack

## Quick start

```bash
npm install
npx --yes "@grok/agent-sdk@0.5.0" validate --dir .
npx --yes "@grok/agent-sdk@0.5.0" dev --dir .
```

Playground: follow the URL printed by `dev`. Webhook (with `serve --dev`):

```bash
curl -sS -X POST "http://127.0.0.1:3000/incident-triage/v1/channels/alertmanager/" \
  -H "Authorization: Bearer $INCIDENT_TRIAGE_WEBHOOK_SECRET" \
  -H 'content-type: application/json' \
  --data-binary @fixtures/alertmanager/firing.json
```

## Layout

| Path | Role |
| --- | --- |
| `bot/` | Agent instructions, tools, channels |
| `evals/` | Smoke eval |
| `fixtures/alertmanager/` | Sample Alertmanager payload + receiver snippet |
| `docs/grok-bot/` | Alternate **Grok Bot** customer playbook (no TypeScript) |

## Slack app

`bot/channels/slack.ts` is ready with `envPrefix: INCIDENT_TRIAGE`. Mint tokens (needs `agent-sdk login`):

```bash
npx --yes "@grok/agent-sdk@0.5.0" slack create --dir . --name "Incident Triage" --prefix INCIDENT_TRIAGE
```

## Config

See [`.env.example`](.env.example). Set values in `.env.local` or deployment secrets (names only in git):

- `INCIDENT_TRIAGE_SLACK_BOT_TOKEN` / `INCIDENT_TRIAGE_SLACK_APP_TOKEN`
- `INCIDENT_TRIAGE_WEBHOOK_SECRET`
- `LOKI_URL` (+ optional `LOKI_TOKEN`)
- `GIT_REPO_PATH` and/or `GITHUB_TOKEN` + `GITHUB_REPO`
- `SLACK_TRIAGE_CHANNEL`

## Alternate path

A chat-configured Grok Bot version of this flow (routines + apps/MCP) lives under [docs/grok-bot/](docs/grok-bot/customer-setup.md).
