---
title: Respond to an exposed credential
description: Revoke or replace an exposed Ferrite token, app secret, third-party key, claim link, or dashboard session at the system that issued it.
topics: ["accounts", "support"]
updated: 2026-11-16
---

Once a credential lands in a chat, log, screenshot, or public repository, treat it as compromised. Delete the leaked copy, then revoke or replace the credential at the issuer. The copy keeps working until the issuer invalidates it.

## Revoke an exposed Ferrite token

The CLI writes your Ferrite token to `~/.config/ferrite/credentials.toml`, and the MCP adapter reads the same file. Anyone holding that token can act as the account until you revoke or replace it.

Ferrite Cloud exposes four credential tools that your agent calls like any other Ferrite tool:

| Tool | Behavior |
| --- | --- |
| `credentials` | Lists every live credential on the account by the first eight characters of its digest (never the raw token), along with its origin and issue time, and marks the credential presented on the current call. Also returns pending changes and the last 16 credential changes. |
| `revoke_other_tokens` | Revokes every credential on the account except the one presented, ends every OAuth session, and cancels pending rotations. Keeps an owner replacement that is already in progress. |
| `rotate_token` | Prepares a replacement token for the credential you presented. The new token activates only after `confirm_token` runs within 15 minutes; the current token stays valid until then. |
| `confirm_token` | Called with the new token as the bearer. Activates the new token and retires the previous one. Safe to repeat. |

An OAuth session token, such as a connector that signed in through the platform authorization page, cannot call `revoke_other_tokens`, `rotate_token`, or `confirm_token`. Use a durable account credential instead.

If your agent's tool list does not include `credentials`, email the Ferrite team with the account ID, where the token appeared, and when. Never include the token itself. See [Get help from the Ferrite team](/kb/guide/get-help-from-the-ferrite-team/).

### Someone else holds a copy of a token you don't use

1. Ask your agent to call `credentials` and note which entry is marked as the presented credential.
2. Ask your agent to call `revoke_other_tokens`. Every other credential stops working immediately, including the exposed token and credentials on other machines.
3. Call `credentials` again to confirm that only your credential remains active, then provision fresh credentials for any other installations that need access.

### The exposed token is the one you use

1. Ask your agent to call `rotate_token`. The tool reply contains the new token, so that agent conversation now holds a live secret; do not share the conversation. Save the new token right away in a credential file you own with mode `600` and the fields `endpoint`, `account_id`, and `token`.
2. Within 15 minutes, call `confirm_token` with `Authorization: Bearer <new token>` to activate the new token and invalidate the exposed one. An agent connection that already attaches an `Authorization` header (such as the Ferrite plugin or a hosted connector) will continue sending the old token, and the platform rejects that call as a credential conflict even if you pass the new token in the `token` argument. Send this single call from a separate MCP client or as a direct HTTP `tools/call` request with `Authorization: Bearer <new token>`. Pass the new token in the `token` argument only from a client that sends no `Authorization` header at all. Do not import the token into the CLI yet; an unconfirmed token authenticates nothing.
3. Import the file with `ferrite login --credentials-file PATH`, delete the file, and run `ferrite account` to confirm the account ID and endpoint.
4. Call `credentials`. If any unrecognized credential appears, call `revoke_other_tokens`.

### You no longer hold a working token

If you claimed the account through its claim link, you are the account owner. Sign in at `https://billing.ferrite.cloud` with the email address and passphrase you set when claiming the account. Open **Credentials**, re-enter your passphrase, and click **Replace every token of this account**. Every existing token stops working at once, and the page prints one new token a single time. Nothing an agent holds can cancel an owner replacement. Store the new token using [Connect the CLI to your account](/kb/guide/fix-sign-in-problems/#connect-the-cli-to-your-account).

### After you respond

Running `ferrite login` does not revoke an exposed token; it only updates what your local CLI stores. See [Ferrite CLI](/developers/cli/) for login flags.

After revoking or rotating tokens, ask your agent to call `list_apps` and `account_statement` to check for unfamiliar apps or charges. If the account still has no owner, claim it immediately: anyone holding a working token can request a claim link, and whoever completes the claim first owns the account. See [Claim an account your agent created](/kb/guide/claim-an-agent-created-account/).

## Replace an app secret

App secrets hold values such as API keys and connection strings read through `ctx.secret`. Secrets are write-only; reads never return their values. Running app code receives the value and can send outbound requests only to declared destinations. If the app printed the secret to stdout or logs, check [Read app logs safely](/kb/guide/read-app-logs-safely/).

To rotate an app secret:

1. Issue a new value at the upstream service and revoke the exposed one there.
2. Store the new value in Ferrite without passing it through an agent when possible. From the project directory, run `ferrite secrets set NAME` (the CLI prompts without echoing input, or reads from a file with `--value-file PATH`; it never takes a secret as a command-line argument). You can also open the app in the dashboard, go to **Settings**, enter the secret name and new value, and click **Set secret**. The dashboard path requires the admin role or higher (while `ferrite secrets set` authenticates directly with your account bearer token), and neither path ever displays the value again. If neither path is available, ask your agent to call `set_secret` with the deployed app ID, secret name, and new value. That puts the secret into the tool call arguments in the conversation transcript, so do not share that conversation or run it in a shared thread.
3. Redeploy so running instances pick up the new value. After `ferrite secrets set`, plain `ferrite deploy` delivers the update even when the source is unchanged, because the CLI tracks the secret change. After an update made in the dashboard or through `set_secret`, the CLI sees no local change and submits nothing, so run `ferrite deploy --force`. Either path runs a full build and incurs the deploy fee.
4. Run `ferrite secrets list` (or have your agent call `list_secrets`) to confirm the secret name is present, then verify that the live app works with the new value.

## Replace a provider key or another third-party credential

Revoke the exposed key in the provider's console and create a replacement. If a Ferrite app reads that key from a secret, rotate the app secret with the steps above.

## Respond to an exposed claim link

Whoever completes a claim link first becomes the account owner. If an unused claim link leaked, complete the claim yourself right away using [Claim an account your agent created](/kb/guide/claim-an-agent-created-account/).

Claim links are single-use and expire after 24 hours, so an already-used link or one older than a day cannot be redeemed. If the claim page reports that the link was already used when you did not use it, or if `ferrite claim` prints no link and says the owner can sign in to the dashboard when you are not that owner, email the Ferrite team with the account ID and where the link appeared. Do not send the link itself.

## Sign out of a dashboard session

If you left a dashboard session signed in on an untrusted device, sign in from a trusted device, open the account menu, and click **Sessions** (which opens **Settings > Access**). Click **Revoke session** beside any session you do not recognize. If you cannot sign in, email the Ferrite team; see [Get help from the Ferrite team](/kb/guide/get-help-from-the-ferrite-team/).
