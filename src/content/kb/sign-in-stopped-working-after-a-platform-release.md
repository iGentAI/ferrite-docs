---
title: Sign-in stopped working after a platform release
description: Each Ferrite platform release is a clean installation, so credentials from the prior release stop working. Create a new account and deploy again.
topics: ["accounts", "cli"]
updated: 2026-11-17
---

Ferrite installs each platform release from scratch instead of upgrading the previous cluster in place. Any credential issued before the release references an account that no longer exists on the new installation.

If no platform release took place, the account likely still exists and the credential expired or was revoked. Follow [Fix sign-in problems](/kb/guide/fix-sign-in-problems/) instead.

## How it shows up

After a platform release, clients fail with authentication errors across every surface:

- Current CLI builds report `MCP HTTP 401 Unauthorized: this login is not known to the platform at <endpoint>. It may come from an earlier installation of the platform` on `ferrite account`, `ferrite deploy`, `ferrite status`, and every other command that calls the platform, followed by the two recovery commands. `ferrite account --json` returns `reason: LOGIN_UNKNOWN_TO_PLATFORM`, `credentialKept: true`, and `next` entries for `ferrite login --endpoint <endpoint> --ephemeral --json` and `ferrite login --credentials-file <file>`. Tools exposed through `ferrite mcp-serve` and the Ferrite plugin's MCP bridge return the same `code` and `next`. The CLI leaves the stored credential file on disk.
- Older CLI builds report `MCP HTTP 401 Unauthorized: the platform did not accept the credential this request carried` and suggest `ferrite login --endpoint <url>` or `ferrite login --ephemeral`. They can also report `the platform rejected the stored credential` with a note that it has expired or been revoked, and suggest `ferrite login --credentials-file`. That import path applies when an account still exists; after a platform release it does not, so skip the import and start a new account.
- Your coding agent's Ferrite tools fail with HTTP 401 `invalid_token` or a bare `Unauthenticated` reply, even when the agent configuration worked before.
- The dashboard prompts you to sign in again. Browser sessions are separate from CLI credentials, so signing in through the browser does not repair the CLI.

Your local credential file stays untouched until you replace it. To check which account it pointed to first, see [Check which account you are using](/kb/guide/check-which-account-you-are-using/).

## Sign in again

No account from the previous installation exists on the new one. That covers claimed dashboard accounts, accounts with team-issued credential files, and trial accounts (which the CLI calls temporary accounts and error messages call test workspaces), along with dashboard owner identities. No token can be reissued for those old accounts.

Create a new trial account (48-hour lifetime on Ferrite Cloud):

```bash
ferrite login --ephemeral --endpoint https://mcp.ferrite.cloud/mcp
```

To work past the 48-hour trial window, create a durable account instead:

```bash
ferrite login --id <name> --endpoint https://mcp.ferrite.cloud/mcp
```

A durable account has no 48-hour limit. Claim it using [Claim an account your agent created](/kb/guide/claim-an-agent-created-account/). You can reuse your previous email address; the prior owner identity no longer exists, so the claim creates a new one.

Run `ferrite account` and verify that it prints the account ID and endpoint you expect.

Update any coding agent that talks to Ferrite:

- If your agent uses the Ferrite plugin, it reads the CLI's credential file and picks up the new login on the next call.
- If `FERRITE_TOKEN` is set alongside `FERRITE_ENDPOINT` in the agent's environment, it overrides the credential file for most commands (while `ferrite account`, `deploy`, `cost`, `statement`, `claim`, and `tasks` read only the credential file). Unset both or update them to the new token.
- If a hosted MCP endpoint uses a manually configured bearer header, replace that token by hand, then start a new agent session.
- If the agent connects through an OAuth connector, sign in again through the connector.

## Deployed apps

Once `ferrite account` succeeds, deploy each app again from its source directory with `ferrite deploy`. A new trial account starts with $5 of credit; a durable account starts without credit, so buy credit in the Dashboard before deploying to it. See [Prepare for a platform release](/kb/guide/prepare-for-a-platform-release/) for the rest of the post-release checklist, including re-entering app secrets.
