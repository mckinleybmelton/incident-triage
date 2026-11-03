# Incident triage (Grok Bot customer simulation)

Customer pain: on-call engineers spend the first part of every incident figuring out what broke and whether it matters.

This repo is a **Grok Bot** setup playbook — not an Agent SDK TypeScript agent. It shows how a customer would wire Prometheus Alertmanager, Loki, Git, and Slack through a Bot + webhook routine.

## Quick start

1. Read **[docs/customer-setup.md](docs/customer-setup.md)** and follow the steps in Grok Bot.
2. Paste routine text from **[docs/routine-instructions.md](docs/routine-instructions.md)**.
3. Point Alertmanager at the routine using **[fixtures/alertmanager/receiver.snippet.yml](fixtures/alertmanager/receiver.snippet.yml)**.
4. Smoke-test with **[fixtures/alertmanager/firing.json](fixtures/alertmanager/firing.json)** (curl instructions in the setup doc).

## Docs

| Doc | Purpose |
| --- | --- |
| [docs/customer-setup.md](docs/customer-setup.md) | End-to-end customer setup |
| [docs/routine-instructions.md](docs/routine-instructions.md) | Copy-paste routine Instructions |
| [docs/connectors.md](docs/connectors.md) | Slack, Loki MCP, Git options |
| [docs/gaps-vs-agent-sdk.md](docs/gaps-vs-agent-sdk.md) | Limits and when to upgrade |

## Flow

Alertmanager → Grok Bot webhook routine → Loki + Git evidence → Slack triage summary → optional Slack follow-ups.

## Out of scope

- Building or hosting a production Loki MCP server (customer supplies a public HTTPS MCP)
- Agent SDK scaffold / Cursor agent hosting deploy (see gaps doc for the upgrade path)
