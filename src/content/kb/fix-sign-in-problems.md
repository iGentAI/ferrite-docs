---
title: Fix sign-in problems
description: Identify which Ferrite sign-in layer failed (dashboard, CLI and MCP, or your own app) and fix that layer without creating a second account.
topics: ["accounts", "cli"]
updated: 2026-11-16
featured: true
---

Ferrite keeps three authentication layers separate:

- The dashboard uses a browser session tied to your owner email.
- The `ferrite` CLI and `ferrite mcp-serve` share one stored credential bound to one endpoint and one account.
- Apps you build authenticate their own users through the `auth` package installed by `ferrite add auth`, independently of the platform.

Repairing one layer leaves the other two untouched. Start from the exact error you hit.

## Identify the failing sign-in

| Error or symptom | What failed and where to fix it |
| --- | --- |
| **Session expired** in the dashboard, or redirected to **Sign in to Ferrite** | Your browser session ended. CLI credentials and apps are unaffected. See [Sign in to the dashboard again](#sign-in-to-the-dashboard-again). |
| `ferrite account`, `ferrite status`, or another command reports `MCP HTTP 401 Unauthorized: this login is not known to the platform at <endpoint>` (bare 401s or older CLIs: `the platform did not accept the credential this request carried`; older platforms: `the platform rejected the stored credential`), or your agent receives HTTP `401` `invalid_token` (older platforms: `Unauthenticated`) | The endpoint rejected the stored CLI credential. See [Connect the CLI to your account](#connect-the-cli-to-your-account). |
| `account: not logged in`, `not logged in: there is no credential document at ...`, or `no Ferrite Cloud endpoint configured` (older CLIs: a path to `credentials.toml` followed by `No such file or directory`) | No CLI credential exists on this machine. See [Connect the CLI to your account](#connect-the-cli-to-your-account). |
| Your app returns `503` naming a secret, displays **No sign-in is in progress**, bounces back to its sign-in page after OAuth, or returns `403` to a signed-in user | Your app's `auth` package configuration failed. See [Fix sign-in to an app you built](#fix-sign-in-to-an-app-you-built). |

## Sign in to the dashboard again

When the dashboard shows **Session expired**, click **Sign in again**. Sign in with the email and passphrase you set when claiming the account, with Google or GitHub (where offered) using a provider account with that same verified owner email, or with **Use a passkey** (where offered) after entering the owner email.

The [Ferrite dashboard](https://dashboard.ferrite.cloud) matches owners by email address and opens the accounts claimed by that address. A provider email that owns no Ferrite account signs in to an empty state; the dashboard has no sign-up flow that creates accounts. If an expected account is missing, sign out and sign in with the email address that claimed it.

An account created by an agent (ID starting with `eph-` or created with `ferrite login --id`) has no owner until you claim it; see [Claim an account your agent created](/kb/guide/claim-an-agent-created-account/). An `oauth-` account created by a chat connector cannot be claimed: its session cannot mint a claim link, and each new authorization creates another `oauth-` account. Deploy anything you want to keep from a claimed durable account, which has no 48-hour limit.

## Connect the CLI to your account

The CLI and `mcp-serve` read one stored credential bound to one endpoint and one account. Provisioning issues the initial credential; owners can mint extra named tokens in the dashboard under **Settings > API tokens**.

A previously working credential stops working when:

- A platform release replaced the installation and the old account no longer exists. See [Sign-in stopped working after a platform release](/kb/guide/sign-in-stopped-working-after-a-platform-release/).
- A trial account passed its 48-hour window.
- Another credential on the same account called `revoke_other_tokens`, or confirmed a rotation with `confirm_token` and retired the old token.
- The owner revoked that named token under **Settings > API tokens** or replaced all account credentials.
- The credential is sent to a different endpoint than the one that issued it.

The CLI reports all of these as `MCP HTTP 401 Unauthorized: this login is not known to the platform at <endpoint>` (bare 401s or older CLIs: `the platform did not accept the credential this request carried`; older platforms: `the platform rejected the stored credential`).

`ferrite login` stores credentials in four ways. Only `--sign-in` and `--credentials-file` reach an account that already exists:

| Command | Behavior |
| --- | --- |
| `ferrite login --sign-in` | Opens the browser to sign in with Google or GitHub, pick an account you own and click **Allow**, then saves a named login for this computer. This is how a second computer reaches your account. |
| `ferrite login --ephemeral` | Creates a new 48-hour trial account (`eph-`; CLI calls it a temporary account, error text says test workspace) and overwrites the stored credential. When the 48 hours end, its apps go offline unless you sign in to keep it. Use only when starting fresh; never run it to recover an existing account. |
| `ferrite login --id <name>` | Creates a new durable account with that ID and overwrites the stored credential. Claim it afterwards ([Claim an account your agent created](/kb/guide/claim-an-agent-created-account/)). |
| `ferrite login --credentials-file PATH` | Imports a mode-`600`, user-owned TOML file with `endpoint`, `account_id`, and `token`. Rejects files whose `account_id` does not match what the token authenticates as. `ferrite login --credentials-stdin` reads the same TOML from a pipe. |

See [Ferrite CLI](/developers/cli/) for the full command reference.

To repair your CLI sign-in:

1. Check whether your shell or agent MCP config exports `FERRITE_ENDPOINT` or `FERRITE_TOKEN`. When `FERRITE_ENDPOINT` is set, most commands (including `mcp-serve`) use it over the stored endpoint, and read `FERRITE_TOKEN` only when `FERRITE_ENDPOINT` is also set. Six commands (`ferrite account`, `ferrite deploy`, `ferrite cost`, `ferrite statement`, `ferrite claim`, and `ferrite tasks`) always read only the credential file. Check without printing the token:

   ```bash
   printenv FERRITE_ENDPOINT
   [ -n "${FERRITE_TOKEN:-}" ] && echo "FERRITE_TOKEN is set"
   ```

   Remove any stale export from your shell profile or scripts and open a fresh terminal.

2. Check which account the CLI was targeting. On a `401`, `ferrite account` prints only the rejection, so inspect the account and endpoint lines in `~/.config/ferrite/credentials.toml` (or the file named by `FERRITE_CONFIG`) without copying the token, or check the account recorded in your project's deployment journal. See [Check which account you are using](/kb/guide/check-which-account-you-are-using/).

3. If the account ID starts with `eph-`, it is a trial account. Nothing can reissue its credential, and it expires 48 hours after creation. Run `ferrite login --ephemeral` to start a fresh trial account, or switch to a durable account you own.

4. For an account you own, run `ferrite login --sign-in`, continue with Google or GitHub, pick the account and click **Allow**; then run `ferrite account --json` to confirm it. For a machine without a browser, sign in to the dashboard as the owner ([Sign in to the dashboard again](#sign-in-to-the-dashboard-again)), select the account, open **Settings > API tokens**, and create a named token for this machine. Click **Copy credentials file**, save the TOML to a private file with mode `600`, and import it with `ferrite login --credentials-file PATH`. Delete the temporary file afterwards and run `ferrite account --json` to confirm the exact account and endpoint. Named tokens leave other machines unaffected and can be revoked individually. Importing overwrites this machine's saved CLI login, so skip it if your current login already targets the account you want.

5. Do not run `ferrite agent connect` or `ferrite agent recover`; Ferrite Cloud does not serve them, and `ferrite login --sign-in` replaces them. Once the CLI authenticates as the right account, point your coding agent at that `ferrite` executable with `mcp-serve`, and keep tokens out of the agent configuration. To start a new durable account, run `ferrite login --id <name>` and claim it ([Claim an account your agent created](/kb/guide/claim-an-agent-created-account/)).

Never paste a Ferrite token into a chat, a dashboard field, an agent MCP configuration, or a support message.

## Fix a credential file that the CLI refuses

The CLI reads `~/.config/ferrite/credentials.toml`, or the path in `FERRITE_CONFIG`. `ferrite account`, `ferrite deploy`, `ferrite cost`, `ferrite statement`, `ferrite claim`, and `ferrite tasks` reject a credential file that is a symbolic link, belongs to another user, or has permissions other than `600`.

In a container or CI job, verify `FERRITE_CONFIG` points to the expected file and that the active user owns it with mode `600`.

## Fix an agent that can't use Ferrite tools

If `ferrite account` succeeds in your terminal while your agent fails, inspect the agent's MCP configuration:

- Start a new agent session. Running sessions do not reload MCP configs.
- List MCP servers in your agent and confirm the `ferrite` entry runs `mcp-serve` without setting `FERRITE_TOKEN` or `FERRITE_ENDPOINT`.
- If multiple `ferrite` binaries are installed, verify the absolute path in the agent config matches `command -v ferrite`.

If it still fails, send the Ferrite team the account ID, the endpoint, the output of `ferrite --version`, and the exact error text. See [Get help from the Ferrite team](/kb/guide/get-help-from-the-ferrite-team/).

## Fix sign-in to an app you built

End-user sign-in in your own app comes from the `auth` package vendored into `src/auth/` by `ferrite add auth`. Check `src/auth/SETUP.md` for its full requirements, or match the failure below.

### `503` naming a secret

Required configuration is missing. The `auth` package needs `auth_public_origin`, `auth_session_key`, `auth_allow`, and the client ID and secret for at least one provider. Set each with `ferrite secrets set <NAME>` (or the MCP `set_secret` tool) and deploy again, because secrets reach the running app only through a deployment.

A secret set with `ferrite secrets set` makes the next `ferrite deploy` rebuild even when source is unchanged. A secret set with the MCP `set_secret` tool is invisible to the local CLI, so follow it with `ferrite deploy --force`.

### Redirect URI mismatch from the provider

Register `<auth_public_origin>/auth/callback/github` or `<auth_public_origin>/auth/callback/google` with your OAuth provider. `auth_public_origin` must be the exact lowercase origin people visit, with no path and no trailing slash. Run `ferrite host` to print the origin and both callback URLs, or compute the origin using [Find your app's URL](/kb/guide/find-your-app-url/).

### No sign-in is in progress

If the app reports **No sign-in is in progress** or bounces you back to its sign-in page after OAuth, the `__Host-ferrite_auth` cookie did not return on the callback. Confirm that every route hitting the `auth` package lists `cookie` in `forward_headers`, that users visit over `https://`, and that the hostname matches `auth_public_origin` (the `__Host-` cookie is bound to one host).

### `403` with `not_on_access_list`

Authentication succeeded, and the user is not on the access list. Either add them to the `auth_allow` secret and redeploy, or have someone listed in `auth_admins` add them on the app's `/auth/access` page, which takes effect without a deployment.

### `403` starting with `csrf:`

A state-changing request arrived without the session's CSRF token or from another origin. Scripts read the token from `GET /auth/session` and pass it in the `x-csrf-token` header; plain HTML forms submit it in a `_csrf` field. Verify the route forwards `origin`, `sec-fetch-site`, and `x-csrf-token`, plus `content-type` for form posts.

### `401` with `sign_in_required`

A non-navigation request arrived without a valid session (browser page loads redirect to the sign-in page). Sessions expire 12 hours after sign-in.

See [Authentication](/developers/authentication/) for the complete setup guide.
