---
title: Prepare for a platform release
description: Every Ferrite platform release is a clean installation that starts empty. Keep your source code, secret values, and domain records locally so you can redeploy on the new installation.
topics: ["accounts", "deploys"]
updated: 2026-11-16
---

Every Ferrite platform release is a clean installation from scratch. The new installation starts empty, with no accounts, apps, or stored data carried forward from the previous one. Ordinary app deployments behave differently: running `ferrite deploy` replaces your app's compiled binary and leaves its stored service data untouched.

## What resets on a platform release

None of the following state carries over into the new installation:

- All accounts (trial or durable, claimed or unclaimed), every owner identity created by claiming an account, and all credentials and tokens issued for them.
- All deployed apps, their assigned hosts, previous build artifacts used for rollbacks, previews, named releases, and state forks.
- All data stored in bound services: key-value entries, transaction state, queued, delayed, and dead-lettered messages, stream records, and stored objects.
- Account balances, including trial credit and purchased credit.
- App secrets.
- Custom hostname claims and bindings.
- Hosted source repositories and platform deployment histories.
- Recent app log tails and account notifications.

Because accounts from the previous installation no longer exist, the Ferrite team cannot reissue credentials for them.

## What stays on your machine

A platform release leaves your local machine untouched. Your project directory, source tree, and `ferrite.json` remain intact. Two local files become stale because they reference the retired installation:

- Your stored CLI credential names an account that no longer exists, so requests fail with HTTP 401. Your local setup is undamaged; follow [Sign-in stopped working after a platform release](/kb/guide/sign-in-stopped-working-after-a-platform-release/) to authenticate against the new installation.
- The `.ferrite/deployments/` journal inside each project records prior deployment attempts tied to accounts and apps from the previous installation.

## Before a release

Back up everything you will need to reconstruct your deployments:

1. Keep your application source on your own machine and in a repository you control. Never treat the hosted source repository as your only copy.
2. List your secret names with `ferrite secrets list` (or the MCP `list_secrets` tool) and keep their values in your own password manager or vault. Ferrite secrets are write-only; the platform never returns secret values after they are set.
3. Record every custom hostname you claimed and bound, along with the app it mapped to.
4. Export any stored data you need to preserve through your app's own pages or HTTP API.
5. Record any schedules that rely on delayed queue messages, since delayed jobs due after the release will not run on the new installation.

## After a release

Rebuild your account and apps in this order:

1. Create a new account and sign in again (see [Sign-in stopped working after a platform release](/kb/guide/sign-in-stopped-working-after-a-platform-release/) for trial and durable accounts). If you plan to keep the account, claim it again per [Claim an account your agent created](/kb/guide/claim-an-agent-created-account/). A new trial account starts with $5 of credit; any other account starts without credit, so check its balance before deploying.
2. Re-apply each secret with `ferrite secrets set NAME`, or have your agent call `set_secret`.
3. Run `ferrite deploy` from your local source tree. The app starts with empty service bindings, so populate any required initial state through your app's code, pages, or API.
4. Check the app's assigned URL. The default host derives from the app ID (`ACCOUNT/NAME`). Every trial account receives a new account ID and therefore a new host; an app keeps its previous default host only when deployed under the same account ID and app name. If the host changed, update published links, external webhook URLs, and discovery documents. See [Find your app's URL](/kb/guide/find-your-app-url/).
5. Re-claim, verify, and bind any custom hostnames from the new account per [Custom domains and TLS](/kb/guide/custom-domains-and-tls/).
6. Re-publish any delayed jobs scheduled to fire after the release.

If an app still fails after you sign in and redeploy, see [Get help from the Ferrite team](/kb/guide/get-help-from-the-ferrite-team/).
