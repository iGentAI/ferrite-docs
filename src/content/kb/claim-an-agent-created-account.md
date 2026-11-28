---
title: "Claim an account your agent created"
description: "Keep a trial your agent started as your own account, or move its apps into the Ferrite account you already have, with one private link and one sign-in."
topics: ["accounts"]
updated: 2026-11-25
featured: true
---

Ask your agent for the claim link, open it, and sign in with Google or GitHub. That one step makes the account yours. Agents open Ferrite accounts on their own, so you can try Ferrite without signing up: a terminal agent runs `ferrite login --ephemeral`, and a connector starts the same trial when you choose **Try Ferrite without an account**. A trial gets $5 of credit, enough to run an app or a few for 48 hours, with one instance per app, 256 MiB of memory and half a CPU, and its apps go offline when the 48 hours end unless you sign in to keep them.

## Keep it or move it

After you sign in through the claim link, a trial offers two choices:

| Choice | What happens |
| --- | --- |
| **Keep this as my account** | The trial becomes a permanent account of your own, with the same apps, their URLs and data. Its account ID changes from `eph-…` to a readable one, and the CLI login and every connected agent follow it automatically. The 48-hour deadline and the trial limits are gone, and you buy more credit in the Dashboard. |
| **Move it into** your existing account | The trial's apps move into the account you already own, with their IDs, URLs and data. The CLI login and every connected agent of the trial follow them, so their next call already works in your account. |

Choose **Keep** when this is your first Ferrite account. Choose **Move** when you already have one, so all your apps live in one place. A durable account that an agent created without an owner has nothing to keep: signing in simply attaches it to you.

## Claim the account

1. Tell your agent "keep this" or "I already have a Ferrite account". It checks `owner_status` and, when the account has no owner, calls `claim_url` and gives you the link. Through `ferrite mcp-serve` the tools are `remote_owner_status` and `remote_claim_url`. A trial started from a connector mints the link the same way.
2. Open the link. The page shows the account ID, balance and app count.
3. Continue with Google or GitHub, then choose **Keep this as my account** or **Move it into** one of your accounts.
4. Ask your agent to call `owner_status` and `account` to confirm the result (after **Keep** the account ID is the new one), then open the [Ferrite dashboard](https://dashboard.ferrite.cloud) and check that the account ID and apps are there.

Each claim link works once and expires after 24 hours. Keep it private until you finish, because the first person to complete it becomes the owner. The reply that carries the link also holds a `web_token` for the same claim; keep it as private as the link.

From a terminal, `ferrite claim --link` prints the same link, and `ferrite claim --link --wait` then switches that computer's login to the account the trial went to. Plain `ferrite claim` moves a trial's apps into a new durable account without the Dashboard, for a computer with no person to open the link. See [`ferrite claim`](/developers/cli-commands/#ferrite-claim). A script without the CLI moves a trial's apps with the MCP `claim` tool; see [Keep a trial app past its 48 hours](/developers/mcp-only-operations/#keep-a-trial-app-past-its-48-hours).

The dashboard then shows the account's prepaid balance. Every charge draws from it, deploys that exceed it are refused, and apps stop when it reaches zero; see [Understand usage and credits](/kb/guide/usage-and-credits/). To add credit, ask your agent to call `billing_portal` and open the returned `topup_url`, or use **Usage & billing** in the dashboard.

If the original agent session is gone, open a new session and ask the agent to call `account`. On the same computer, the CLI and every local agent share one login, so `ferrite claim --link` in a terminal works too. If no agent and no CLI still holds the account, no claim link can be requested; email the Ferrite team with the account ID.

## Use the account from your other agents

Once the account has an owner, every other agent joins it by signing in. A terminal agent on another computer runs `ferrite login --sign-in`; a connector or remote MCP server offers **Sign in to your Ferrite account** on Ferrite's connect page. Both lead to Google or GitHub, the account picker and **Allow**. See [Connect any agent to your Ferrite account](/developers/connect-any-agent/).

Each agent connected through a connector or remote MCP server appears under **Connected agents** in the dashboard. There you can move a connection to another account you own or revoke it. To start a fresh trial or sign in to a different account from that agent, disconnect Ferrite in the agent and connect it again.

## If the claim doesn't complete

| Message | What it means and what to do |
| --- | --- |
| `This link was already used` (or `This claim link has been used`) | If you finished the sign-in, the account is yours; open the dashboard. If you did not, someone else used the link. Stop using the account for private work and email the Ferrite team with the account ID. |
| `This claim link has expired` or `Too many attempts` (or `This claim link is locked`) | Ask your agent for a new claim link. |
| `account '...' is already claimed` | An owner is already attached. Call `owner_status` to see which email owns it, then sign in as that owner. |
| `Unknown claim link` (or `This is not a claim link`) | The URL is incomplete. Copy the full URL again from the agent's reply or the CLI. |

For any other error, send the account ID and the exact page text to the Ferrite team; see [Get help from the Ferrite team](/kb/guide/get-help-from-the-ferrite-team/).

## If your apps are in more than one account

Agents that started separate trials hold separate accounts. Claim each one and choose **Move it into** the account you want to keep, and the apps end up together. See [Check which account you are using](/kb/guide/check-which-account-you-are-using/).
