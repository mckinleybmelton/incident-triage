# Connectors for On-call Triage

How a customer wires Slack, Loki, and Git for the Grok Bot flow.

## Slack

Two different features — both matter.

| Piece | Role |
| --- | --- |
| **Slack app** (Connect apps) | Lets the Bot **read/post** as the Slack user you authorized |
| **Slack trigger** (on a routine) | **Starts** a routine when a message/mention/reaction matches |

### App setup

1. Connect apps → Slack → Authorize.
2. The Bot posts as that user, only in channels that user can post in.
3. Invite is not a separate Slack bot install for the personal app path; the connected user must already be in private channels.

### Trigger setup (follow-ups)

- Prefer: one channel (`#oncall-triage`) + Bot mention, or a phrase like `triage follow-up`.
- Avoid: “any message” on a busy channel — routines spend weekly usage per run.
- Only **new** messages after the trigger is active start runs.

### Team Bot note

If the team later publishes a Team Bot into Slack, that identity can be a dedicated Slack app teammates @mention. This playbook’s first cut uses the connected-user Slack app, which matches how most customers start.

## Loki

There is no assumed first-party “Loki” tile. Customers typically choose:

### A. Custom MCP (recommended)

- Expose a Loki-backed MCP over **public HTTPS** (streamable HTTP or SSE).
- In Bot chat: `Add this MCP server: https://<host>/mcp`
- Grok Bot runs in the cloud — **localhost MCP on a laptop is not reachable**.
- Private VPC Loki needs a gateway, reverse proxy allowlist, or Tailscale Funnel (or similar) so the Bot can reach it.

**Suggested MCP tool surface (customer-owned server):**

| Tool | Purpose |
| --- | --- |
| `query_range` / `query_loki` | LogQL query with start/end, hard limit on lines |
| `label_values` (optional) | Discover service/namespace labels |

Cap result size in the MCP server so triage stays readable.

### B. Grafana computer-use (fallback)

- Bot opens Grafana Explore in its browser with a saved session / 1Password login.
- Slower and brittle (SSO, captchas, session expiry).
- Acceptable for a pilot; plan to replace with MCP.

### C. Not supported without a bridge

- Agent-only access to a cluster-local Loki URL (`http://loki.monitoring.svc`) with no public path.

## Git / recent deploys

| Option | When to use |
| --- | --- |
| **GitHub app** (Connect apps) | SaaS GitHub; Bot lists recent commits on the service repo |
| **Git on Bot computer** | Clone the repo once onto the shared Bot computer; `git log` during triage |
| **GitLab / other via MCP** | Custom HTTPS MCP that wraps the forge API |

Standing instruction tip: tell the Bot the default repo or path mapping (`service label payments` → `acme/payments`).

Deploy correlation beyond `git log` (Argo, Spinnaker, etc.) is out of scope unless the customer adds an MCP for that system.

## Alertmanager → Grok Bot webhook

- Routine Webhook section gives **POST to** URL + Bearer **key**.
- Alertmanager `http_config.authorization` sends `Authorization: Bearer <key>`.
- HTTP **200** = run accepted, not finished.
- Alertmanager retries on 5xx; design Instruction duplicate-guard + Alertmanager grouping to limit double Slack posts.
- Routine rate limits apply (account and per-routine hourly caps) — see [gaps-vs-agent-sdk.md](gaps-vs-agent-sdk.md).

## Secrets

- Routine webhook key: treat like a production webhook secret; do not commit it.
- Loki MCP tokens: prefer server-side auth on the MCP host; do not paste long-lived tokens into routine Instruction text.
- Slack: OAuth via Connect apps; no bot token file in this repo.

## Minimal pilot vs hardened

| Pilot | Hardened |
| --- | --- |
| Slack app + Grafana browser + GitHub app + webhook routine | Slack app + Loki MCP + GitHub/git + narrow Slack follow-up + Alertmanager grouping |
| Manual Test + curl fixture | Same, plus runbook owners and key rotation |
