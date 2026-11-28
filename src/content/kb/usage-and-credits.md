---
title: Pricing, usage and credits
description: Check app pricing with estimate_cost, read charges on your statement, and find billing support when credit purchases are disabled.
topics: ["billing", "accounts"]
updated: 2026-11-28
---

Every Ferrite account runs on a prepaid balance. Deployments always draw from it, and an installation can also meter running apps, requests, and reserved service data. When the balance cannot cover a paid operation, the platform refuses the work instead of extending credit.

The dashboard displays amounts in credits. CLI and MCP tools report the same values in micros in fields such as `credit_micros`, where 1,000,000 micros equals one credit.

## Check the balance

Every surface reads the same account ledger:

- Run `ferrite statement` for the current balance, total charges and funding, and recent billing entries. Pass `--json` for the raw structured reply.
- Ask your coding agent to call `account` for the account ID and `credit_micros`.
- In the dashboard, click **Usage** in the account navigation to view the balance on **Usage & billing**.
- Ask your agent to call `account_statement` for a ledger history: current balance, total charged, total funded, and one row per charge or funding event with the resulting balance.

A new trial account on Ferrite Cloud receives $5 of credit, enough to run an app or a few for 48 hours. There is no welcome credit: a durable account, including one created with `ferrite login --id` or `provision`, starts without credit, and existing accounts keep their current balance. To find out whether you can buy credit on your installation, see [Add credit](#add-credit). Check the balance on **Usage & billing** or through `account` before deploying.

### What a trial account gets

`ferrite login --ephemeral` creates a trial account (the CLI calls it a temporary account, error messages call it a test workspace, and its ID starts with `eph-`). A trial account lasts 48 hours and starts with $5 of credit, with no account and no card. It runs one instance per application with 256 MiB of memory and half a CPU and caps source uploads at 32 MiB. When the 48 hours expire, its apps go offline unless someone signs in through the trial's claim link; signing in keeps the account and its applications.

On Ferrite Cloud, `ferrite deploy` deploys directly from a trial account. Before the trial expires, an agent holding the session's `claim_token` can move its apps into a durable account with the MCP `claim` tool; see [Claim an account your agent created](/kb/guide/claim-an-agent-created-account/).

## What uses credit

Every installation charges a deploy fee. `estimate_cost` reports that fee in `deploy_fee_micros`. Because the installation sets the amount, read it from `estimate_cost` instead of relying on a static number.

Depending on configuration, an installation can also meter three ongoing dimensions (`estimate_cost` notes which meters are active):

- Running apps, priced for the memory and CPU their instances occupy.
- Request traffic, metered by the gateway in batches.
- Data reserved by an app's services: disk at the storage rate, and engine memory at the memory rate. Scaling an app to zero instances stops compute billing, while reserved service data keeps billing until you withdraw the app. The reserved-data charge pauses only while an account is stopped at a zero balance with no apps running.

On Ferrite Cloud, running apps are metered hourly alongside deploy fees, drawn from the prepaid balance with no plan fee and no seat fee.

To inspect costs before deploying, run `ferrite cost` in the project directory or ask your agent to call `estimate_cost`. Both return the current balance, deploy fee, projected monthly cost per app at current rates, active rates, account tier, limits, and active-meter notes without charging or deploying anything. Add `--instances N` to compare an instance count, or `--json` for raw rates and limits. Monthly figures are projections for the submitted footprint, so live traffic and later resource changes alter your bill. `ferrite mcp-serve` exposes the same checks through `remote_estimate_cost` and `remote_account_statement`. Check `account_statement` to see recorded charges and funding events.

For per-app traffic and spend, call `usage`. It returns request, error, byte, and latency totals alongside the micros charged for that app's requests. Totals come from gateway usage events, so a zero means no events were recorded and does not prove the app received no traffic.

## When the balance runs out

When funds cannot cover paid work, the platform enforces the limit at three points:

- Deployments fail before building if the balance cannot cover the deploy fee. The CLI prints `INSUFFICIENT_CREDIT` with a reason such as `the account holds 0 micros and a deploy needs 15000; nothing was built or charged` (using your balance and the installation's fee). MCP tools return `InsufficientCredit` with `have_micros`, `need_micros`, and `how_to_pay`, which can contain a top-up URL even when the installation has disabled checkout. Check **Usage & billing** for purchasing availability. Nothing builds and nothing is charged.
- Where the gateway credit check is enabled, requests to an app return `402 Payment Required` with the body `prepaid balance exhausted; no lease, no service`.
- On Ferrite Cloud, where running apps are metered, reaching a zero balance stops running apps. The platform holds stopped apps for 30 days and then deletes them along with their data, which cannot be recovered.

Durable accounts follow a fixed shutdown and recovery sequence:

1. The platform emits low-balance notices when remaining runway drops below 7 days and below 24 hours at the current burn rate.
2. At zero balance, the platform records each running app's instance count and autoscale setting, scales every app to zero, and sets a deletion date 30 days out. No charges accrue while the apps are stopped.
3. Adding credit that leaves at least one day of runway at the resumed rate and at least $1.00 triggers an automatic restart of each app at its saved instance count and autoscale setting. If you manually scale a stopped app before topping up, the platform keeps your chosen count instead of restoring the recorded one.
4. After the 30-day deadline, the apps are withdrawn and their data is permanently deleted.

Read these events through `notifications`, or have the platform push them to an HTTPS endpoint as signed webhooks by calling `set_notify_channel` (`notify_channel` checks delivery health). After an automatic restart, open each app's URL to confirm it answers. Trial apps suspend as soon as trial credit runs out. Use the trial’s claim link to keep the account before it expires.

A `502 Bad Gateway` response with the body `credit ledger unavailable` means the gateway could not reach the account ledger, so it refused traffic instead of serving requests unmetered. Your balance is not the cause. If the response continues for more than a few minutes, report it with the deployed app ID and the UTC time.

## Add credit

On Ferrite Cloud, **Usage & billing** shows your balance and says “Purchasing is disabled.” For billing questions, [contact Ferrite support](/kb/guide/get-help-from-the-ferrite-team/) with your account ID. If your agent receives a `topup_url` from `billing_portal`, check the purchasing status in the dashboard before using it.

On installations with card checkout enabled, claim the account first, then open the `topup_url` from `billing_portal` in your browser. Enter card details only on the hosted checkout page. The balance updates once the account ledger confirms payment.

On installations with test credit enabled, an owner or administrator can use **Add test credit** on **Usage & billing**. On other installations, contact the operator for funding options.

If `billing_portal` returns an error, a confirmed payment does not appear within a few minutes, or a line in `account_statement` looks wrong, email the Ferrite team with your account ID, the UTC time of the payment or charge, and the statement line. Never send card details.

To work beyond the 48-hour trial window, sign in through the trial's claim link to keep it ([Claim an account your agent created](/kb/guide/claim-an-agent-created-account/)), or create a durable account with `ferrite login --id` and claim it; durable accounts have no 48-hour limit. See [Connect the CLI to your account](/kb/guide/fix-sign-in-problems/#connect-the-cli-to-your-account).
