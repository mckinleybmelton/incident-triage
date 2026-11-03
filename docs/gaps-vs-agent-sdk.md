# Gaps vs Agent SDK (honest checklist)

This Grok Bot playbook matches how many customers want to start: chat-configured Bot, apps/MCP, webhook routine, Slack. It is not equivalent to a versioned Agent SDK deployment.

## What Grok Bot gives you here

- Fast setup without a TypeScript project
- Webhook wake from Alertmanager (Bearer key on the routine)
- Slack read/post via Connect apps
- Custom MCP for Loki (when publicly reachable)
- Routines + optional skills learned from demonstration
- Cloud execution while laptops are closed

## Gaps to expect in a pilot

| Concern | Grok Bot behavior | Agent SDK alternative |
| --- | --- | --- |
| **Slack write dedupe** | Soft: Instruction + Alertmanager grouping; retries can still double-post | `ctx.host.kv` + idempotent `post_slack_triage` tool |
| **Session coalescing** | Each webhook run is a routine run; continuity is chat/memory | Custom channel + `X-BDK-Session-Key` / continuation |
| **Evals / hillclimb** | Manual Test + human review of chat | `evals/*.eval.ts`, fixtures, CI gates |
| **Typed tools & caps** | Depends on MCP server quality | Authored `bot/tools/*` with hard limits |
| **Dedicated Slack bot identity** | Connected user (or later Team Bot) | `slack create` Socket Mode bot with env prefix |
| **VPC-only Loki** | Needs public MCP/gateway/Funnel | Self-host Agent SDK on your network |
| **Rate limits** | Routine hourly caps (per routine / account); failed runs not auto-retried | Your process limits + Alertmanager retry policy |
| **Versioned review** | Instructions live in Bot/routine UI | Git-reviewed `instructions.md` + PR |
| **Webhook HTTP semantics** | **200** = accepted; work finishes asynchronously in chat | Hosted custom routes return empty **202**; deliver via Slack/tool |

## Success criteria for this simulation

Treat the pilot as successful when:

1. A new teammate can follow [customer-setup.md](customer-setup.md) without Agent SDK docs.
2. `curl` of [../fixtures/alertmanager/firing.json](../fixtures/alertmanager/firing.json) returns **200** and a triage-shaped Slack message appears.
3. On-call can ask a narrow follow-up in Slack and get an evidence-backed reply.
4. The team has read this gaps doc and knows when to escalate to Agent SDK.

## When to graduate to Agent SDK

Move to Agent SDK when any of these become blocking:

- Duplicate Slack noise from Alertmanager retries is unacceptable
- You need automated evals on triage quality before changing prompts
- Loki/Git must stay private (self-host the agent next to them)
- You need a dedicated Slack bot, signed webhooks with platform `401`, or peer agents

The earlier Agent SDK design for this scenario: Alertmanager custom channel, `query_loki` / `recent_commits` / `post_slack_triage` server tools, smoke evals, Cursor-managed or self-hosted deploy.

## Rate-limit quick reference

From Grok Bot routines help (verify against current docs if limits change):

- Account routines: up to **300** runs/hour total
- Single routine: up to **200** runs/hour
- Over limit → failure (`Automation run rate limit exceeded`); not auto-retried
- Busy Slack triggers and Alertmanager flaps can burn weekly usage quickly — keep triggers narrow and grouping tight
