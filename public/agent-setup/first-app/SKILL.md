---
name: ferrite-first-app
description: Create the complete Ferrite live-counter starter with the installed CLI, verify it locally, and deploy it to the selected account after confirmation. Use when a user chooses the first-app onboarding example.
---

# Run your first Ferrite app

Build the CLI's `webapp` starter: a browser page, a saved counter, and a live update feed. Use the packaged template instead of asking the user for source code, a manifest, or server configuration. Keep the example on public sample data; do not add private data or connect external services.

## Verify setup and account

If setup is incomplete, read `https://docs.ferrite.cloud/agent-setup/SKILL.md` and complete it first. Preserve the selected endpoint and exact account ID from the invoking prompt. Run every command with `FERRITE_CLI_BIN` or the verified executable from setup (`ferrite` below is shorthand).

Run `ferrite account --json` before cloud work. If the account differs or the credential has expired, stop cloud work and explain the recovery step. Never create another account or overwrite a working credential. Local scaffolding and tests can proceed without claiming cloud setup succeeded.

A trial account (`ferrite login --ephemeral`) can run every step below, including deployment, on its $50 platform-funded balance. Tell the user before deploying that the account and app expire 48 hours after account creation. A new durable account on Ferrite Cloud starts with $50 in welcome credit; check its current balance first.

For Dashboard access, or to keep the work, check `owner_status` (`remote_owner_status` through `mcp-serve`) on the current account. If it has no human owner, give the user its private, single-use `claim_url` link (`remote_claim_url`). After Google or GitHub sign-in the link offers **Keep this as my account**, which makes a trial a permanent account of the user's own with the same apps, URLs and data and no deadline (its ID changes from `eph-…`), or **Move it into** an account the user already owns. Either way this computer's login follows: run `ferrite account --json` afterwards and use the account ID it reports. A client without the CLI moves trial apps by following `https://docs.ferrite.cloud/developers/mcp-only-operations/#keep-a-trial-app-past-its-48-hours`. Never expose account or claim tokens.

## Create the complete example

Create a new directory named `hello-ferrite` in the user's workspace. If `hello-ferrite` already exists, leave it untouched, choose an unused sibling name, and use that name in all following commands. Never overwrite an existing app.

Scaffold and test the example:

```bash
ferrite new webapp hello-ferrite --with-tests
cd hello-ferrite
ferrite check --json
ferrite test
```

The generated `site/index.html` is the browser page, and the generated tests cover the counter and live feed. Never replace a failing test with a compile-only check. If the CLI or template fails its own checks, report the exact command and failure; do not require a platform checkout to fix it.

This starter is a public example and needs no sign-in. When the user wants an app with users of its own, such as shop customers or team members, add sign-in with `ferrite add auth` and set `auth_allow` (`*` for a customer-facing app, or a domain or list of people for an internal tool). Which pages require sign-in is a product decision: a shop's catalog stays public while its account and checkout pages do not. Follow `https://docs.ferrite.cloud/developers/authentication/`.

## Confirm deployment

Tell the user which account will receive the app, explain that deploying and serving draw from its credit balance, and show the platform quote from `ferrite cost` (or `estimate_cost`) with its amount, scope, and assumptions. Ask for confirmation before deploying unless the user already explicitly authorized it. Never invent a price, purchase credits, or change a spending limit.

After confirmation and exact-account verification, deploy:

```bash
ferrite check --remote --json
ferrite deploy
```

Follow the build and operation to a terminal result. If interrupted, run the printed resume command instead of submitting another app. Record the returned account, app, build or operation ID, and HTTPS URL. A build receipt alone does not confirm a live deployment.

## Verify the user's first success

At the returned URL, verify all three steps:

1. Open the page and read `/api/count`.
2. Click the increment button and confirm the displayed count rises. If browser automation is unavailable, send one `POST` request to `/api/increment` with a unique `idempotency-key` header and read `/api/count` again.
3. Reload the page (or repeat the count read) and confirm the value persists.

If any step fails, report the exact failure and keep the deployment identity for diagnosis; do not mark onboarding complete. An API-only check is not browser verification; say explicitly when browser interaction was not tested.

Once verified, provide **Open your live app** as a link to the returned HTTPS URL, name the account and app, and summarize what was verified. Link to the account's dashboard usage page once it has an owner. For a trial account, state its expiry and give the `claim_url` link that keeps it; without that step the app is deleted with the trial. Never expose a token or invent a claim link.

## Cost and billing

Before the first deploy of a new app, run `ferrite cost` (or `estimate_cost`) and report the deploy fee, projected monthly cost, and current account balance. Ask for confirmation before deploying unless the user already explicitly authorized it. Whenever asked what an app costs, run `ferrite cost` in its project directory or call `estimate_cost` with its manifest, and explain that running resources and requests are metered.

Read `ferrite statement` or `account_statement` for current balance and recorded charges. New accounts start with $50 and draw down as charges apply; never infer current balance from the starting grant. `mcp-serve` exposes these as `remote_estimate_cost` and `remote_account_statement`.
