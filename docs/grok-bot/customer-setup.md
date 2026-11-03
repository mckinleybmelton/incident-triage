# On-call Triage Bot — customer setup

This playbook stands up a Grok Bot that wakes on Prometheus Alertmanager webhooks, pulls Loki logs and recent Git activity, and posts a short triage summary to Slack.

You configure this in the Grok Bot app. No Agent SDK project is required.

## What you will have when finished

- A Bot named **On-call Triage**
- Slack connected for posting summaries
- A way to read Loki (custom MCP or Grafana in the Bot browser)
- A way to see recent commits (GitHub app or git on the Bot computer)
- A webhook routine Alertmanager can call
- An optional Slack follow-up routine for on-call questions

## Prerequisites

- A Cursor / Grok Bot account that can create Bots and routines
- Slack workspace access for the account that will connect the Slack app
- Alertmanager that can reach the public internet (to POST to the routine URL)
- Loki reachable from Grok Bot’s cloud (public HTTPS MCP, public Grafana, or a gateway / Funnel) — see [connectors.md](connectors.md)

## 1. Create the Bot

1. Open Grok Bot and create a new Bot.
2. Name it **On-call Triage** (or your team’s brand).
3. Give it standing instructions. Paste:

```text
You are On-call Triage. Your job is night incident triage only.

When an Alertmanager webhook or on-call question arrives:
1. Figure out what broke and whether it matters tonight.
2. Use Loki (or Grafana) for logs around the alert window.
3. Use GitHub or git for recent commits / deploys that might correlate.
4. Post or reply with the fixed triage shape from the active routine.
5. Never remediate, restart, roll back, page extra people, or change prod without explicit human approval in the thread.

If tools are missing or unreachable, say what you could not check and still give a best-effort triage from the alert payload.
```

## 2. Connect apps

1. Open **Connect apps** (sidebar or in-chat Connect card).
2. Connect **Slack**. Finish the browser authorize flow. Confirm it appears under Installed.
3. Connect **GitHub** if your team uses it for the services that page (preferred for recent commits).
4. Confirm the Slack user can post in the on-call channel you will use.

Slack posting uses the connected user, not a separate invite-only bot. The Slack *app* is separate from Slack *triggers* on routines — see [connectors.md](connectors.md).

## 3. Add Loki access

Pick one path (details in [connectors.md](connectors.md)):

**Preferred — custom MCP**

In chat with the Bot:

```text
Add this MCP server: https://<your-public-loki-mcp-host>/mcp
```

Confirm the tools appear on the next message. The URL must be public HTTPS (streamable HTTP or SSE). Localhost MCP on a laptop will not work.

**Fallback — Grafana computer-use**

If you have no Loki MCP yet, tell the Bot which Grafana URL and dashboard/Explore view to use, and that it should query logs there during triage. Expect slower and more fragile runs than MCP.

## 4. Create the Alertmanager webhook routine

In chat with the Bot (adapt channel name):

```text
Create a routine named "Alert webhook triage".
Trigger: webhook.
When it runs, follow the Instruction in docs/grok-bot/routine-instructions.md under "Alert webhook triage"
(or paste that Instruction block here).
Always post the final triage to Slack channel #oncall-triage.
Do not remediate.
```

Or open the Bot → Details → Routines → ask it to set the routine, then **Edit** and paste the Instruction from [routine-instructions.md](routine-instructions.md).

Then open the routine and copy from the **Webhook** section:

| Field | Use |
| --- | --- |
| **POST to** | Alertmanager `webhook_configs.url` |
| **key** | Bearer token for Alertmanager `http_config.authorization.credentials` |
| **header** | Ready-made `Authorization: Bearer …` for curl tests |

Keep the key secret. Rotate by editing the routine with the Bot if it leaks.

## 5. Point Alertmanager at the routine

1. Use [../../fixtures/alertmanager/receiver.grok-bot.snippet.yml](../../fixtures/alertmanager/receiver.grok-bot.snippet.yml) as a template.
2. Replace `POST_TO_URL` and `ROUTINE_BEARER_KEY` with values from the routine Webhook section.
3. Reload Alertmanager.
4. Prefer Alertmanager `group_by` / `group_wait` / `group_interval` so one noisy symptom becomes one webhook delivery when possible.

## 6. Optional — Slack follow-up routine

```text
Create a routine named "On-call follow-up".
Trigger: Slack, channel #oncall-triage, when the Bot is mentioned
(or when a message contains "triage follow-up").
Instruction: paste the "On-call follow-up" block from routine-instructions.md.
Keep the trigger narrow so busy channels do not burn usage.
```

## 7. Smoke test

**Routine Test (safe channel first)**

1. Open **Alert webhook triage** → **Test**.
2. Confirm a triage-shaped message appears in the Bot chat and in Slack.
3. A test does real work (Slack posts, MCP calls). Use a non-prod channel if you can.

**Curl against the webhook**

```bash
export ROUTINE_URL='<POST to from routine Webhook section>'
export ROUTINE_KEY='<key from routine Webhook section>'

curl -sS -X POST "$ROUTINE_URL" \
  -H "Authorization: Bearer $ROUTINE_KEY" \
  -H 'content-type: application/json' \
  --data-binary @fixtures/alertmanager/firing.json
```

- HTTP **200** means Grok Bot accepted the run. It does **not** mean triage finished.
- Watch the Bot chat for the result and Slack for the summary.
- Non-200: routine paused, wrong key, or rate limit — see [gaps-vs-agent-sdk.md](gaps-vs-agent-sdk.md).

## 8. Optional — save a skill

After one good guided triage, ask the Bot to save the path as a skill (for example “night alert triage”) so later runs reuse the same steps without re-explaining connectors.

## Checklist

- [ ] Bot created with standing triage-only instructions
- [ ] Slack connected; can post to the on-call channel
- [ ] GitHub connected or git clone available on the Bot computer
- [ ] Loki MCP added (public HTTPS) or Grafana fallback documented for the Bot
- [ ] `Alert webhook triage` routine active; Webhook URL + key saved in Alertmanager
- [ ] Curl or Test produced a triage-shaped Slack message
- [ ] Optional Slack follow-up routine is narrow (channel + mention/phrase)
- [ ] Team read [gaps-vs-agent-sdk.md](gaps-vs-agent-sdk.md) (dedupe, rate limits, VPC Loki)

## Related

- [routine-instructions.md](routine-instructions.md) — copy-paste Instruction text
- [connectors.md](connectors.md) — Slack, Loki, Git options
- [gaps-vs-agent-sdk.md](gaps-vs-agent-sdk.md) — limits and upgrade path
- [Routines help](https://cursor.com/help/grok-bot/routines)
- [Connect apps](https://cursor.com/help/grok-bot/connect-plugins)
