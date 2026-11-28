---
title: "Check which account you are using"
description: "Run ferrite account, query your agent's account tool, and inspect the dashboard URL to compare account IDs before deploying again."
topics: ["accounts", "cli"]
updated: 2026-11-25
---

Run `ferrite account` in your terminal, ask your agent to call `account` (or `remote_account` under `ferrite mcp-serve`), and inspect the `/a/ACCOUNT_ID/` segment in your dashboard URL. Whenever an app looks missing, a command rejects you as not the owner, or a balance looks wrong, compare those three account IDs before you deploy again. Redeploying under the wrong account creates a second copy of the app and leaves the original where it was.

## Recognize the account types

An account ID's prefix tells you how the account was created and what limits apply:

| Prefix | Created by | Lifetime and limits |
| --- | --- | --- |
| `eph-` | `ferrite login --ephemeral`, **Try Ferrite without an account** on a connector, or MCP `provision_ephemeral` | Trial account (the CLI calls it a temporary account). Lasts 48 hours with $5 of credit, one instance per app, 256 MiB memory, and half a CPU, and its apps go offline after 48 hours unless you sign in through its claim link to keep it. Keeping it creates a durable account with a new, readable ID and the same apps, URLs and data, and every login and connected agent follows. |
| `oauth-` | A chat connector that connected before connector sign-in existed | A separate account of its own. Disconnect the connector, connect it again, and choose **Sign in to your Ferrite account** to work in your own account. |
| Any other ID | `ferrite login --id <name>`, MCP `provision`, the connect page's **Create my Ferrite account**, or keeping or moving a trial | Durable account with no 48-hour expiry and no trial compute cap. |

## Check the CLI

Run `ferrite account` from your project terminal:

```bash
ferrite account
```

The output prints the active account ID and endpoint:

```text
account: ACCOUNT_ID
endpoint: https://mcp.ferrite.cloud/mcp
```

`ACCOUNT_ID` is the account `ferrite deploy` targets from this shell.

Two terminals or machines can report different accounts for any of these reasons:

- The CLI reads `~/.config/ferrite/credentials.toml` unless `FERRITE_CONFIG` points to another file. Containers, CI jobs, and other OS users each have their own credential file.
- `ferrite account`, `ferrite deploy`, `ferrite cost`, `ferrite statement`, `ferrite claim`, and `ferrite tasks` always read the credential file and ignore `FERRITE_ENDPOINT` and `FERRITE_TOKEN`.
- Most other commands (`ferrite status`, `ferrite logs`, `ferrite preview`, and `ferrite mcp-serve`) use `FERRITE_ENDPOINT` in place of the stored endpoint when set, and read `FERRITE_TOKEN` only when `FERRITE_ENDPOINT` is exported beside it. Exporting `FERRITE_TOKEN` alone does nothing; the command prints a warning on stderr.
- Hosted Ferrite Cloud uses `https://mcp.ferrite.cloud/mcp`. A local fleet or another endpoint holds a separate account set.

## Check your coding agent

Local coding agents talk to Ferrite through either the Ferrite plugin bridge (which passes hosted platform tools through) or `ferrite mcp-serve` (which exposes `local_*` and `remote_*` tools). Both read the CLI's credential file unless the agent's MCP configuration overrides `FERRITE_ENDPOINT` and `FERRITE_TOKEN`. A connector or remote MCP server never reads your local credential file: it acts as the account chosen on Ferrite's connect page, either the trial it started or the account you signed in to.

Ask your agent to call `account` (Ferrite plugin or hosted connector) or `remote_account` (`ferrite mcp-serve`) and report the returned `id`.

## Check the dashboard

Every account page in the dashboard starts with `/a/ACCOUNT_ID/`. The account switcher lists every account your owner email has claimed. Unclaimed accounts stay hidden until you claim them; see [Claim an account your agent created](/kb/guide/claim-an-agent-created-account/). If the dashboard shows **Select this account to continue**, click **Select account** before reading its app list.

## Resolve a mismatch

Decide which account owns the work, then apply the matching fix:

- If an app is missing from the dashboard, switch to the account ID that deployed it and ask your agent to call `list_apps`.
- If every surface gets HTTP 401 or reports an unknown account, follow [Fix sign-in problems](/kb/guide/fix-sign-in-problems/) to check whether the token was revoked, the trial expired, or the credential needs replacement.
- If the CLI targets the wrong account, do not create another account to work around it. Run `ferrite login --sign-in`, continue with Google or GitHub, and pick the account you want; on a machine without a browser, import a named token from **Settings > API tokens** with `ferrite login --credentials-file PATH`. See [Connect the CLI to your account](/kb/guide/fix-sign-in-problems/#connect-the-cli-to-your-account).
- If a connector or remote MCP server works in the wrong account, open **Connected agents** in the dashboard and move it to the account you want; it follows on its next call. You can also disconnect it in the client, connect it again, and choose **Sign in to your Ferrite account** on Ferrite's connect page.
- If an agent built on a trial and you want those apps in your own account, ask it for the claim link and choose **Move it into** your account after signing in; see [Claim an account your agent created](/kb/guide/claim-an-agent-created-account/).
- If a deploy was interrupted, run `ferrite deploy resume` from the same project directory. The local deployment journal records the account and endpoint of each attempt and refuses to resume under a different account.

If you ask for support, include the account ID and endpoint from each disagreeing surface. Neither grants access, so both are safe to share; see [Get help from the Ferrite team](/kb/guide/get-help-from-the-ferrite-team/).
