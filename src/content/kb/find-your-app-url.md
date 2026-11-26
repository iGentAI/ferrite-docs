---
title: "Find your app's URL"
description: "Run ferrite host before deploying, read the host line from ferrite deploy output, or call list_apps through MCP to find any deployed app's HTTPS URL."
topics: ["deploys", "cli"]
updated: 2026-11-16
---

Run `ferrite host` inside your project directory to see an app's HTTPS URL before your first deploy, or read the `host:` line printed when `ferrite deploy` completes. Ferrite derives each app's hostname deterministically from its app ID (`ACCOUNT/NAME`, where `ACCOUNT` is the deploying account ID and `NAME` is `name` from `ferrite.json`). Redeploying with the same account, app name, and endpoint updates the existing app and keeps the exact same host.

## Find the URL before the first deployment

Run `ferrite host` from your project directory:

```bash
ferrite host
```

The command prints the host and origin, labels the host `derived` until a deploy confirms it (`confirmed` afterward), and prints OAuth callback URLs when the app uses the `auth` package. On a local fleet whose endpoint does not encode a public app domain, set `FERRITE_APP_DOMAIN` first.

The hostname has the form `SHORTCODE.DOMAIN`, where `SHORTCODE` is 16 lowercase base-36 characters derived from the SHA-256 of `ACCOUNT/NAME` and `DOMAIN` comes from your MCP endpoint (`https://mcp.DOMAIN/mcp`). Over MCP, call `app_host` where the installation exposes it, or compute the shortcode directly using the formula in [Authentication](/developers/authentication/#4-find-the-applications-address).

## Read the URL after a deployment

A successful `ferrite deploy` ends with:

```text
deployed: ready
host: https://HOST/
charged_micros: AMOUNT
```

`HOST` is the 16-character shortcode plus the installation's app domain, printed once the platform confirms desired instances are running the new version. `AMOUNT` is the deploy charge in micros, or `null` if none was recorded. Pass `--json` to get `host` (without `https://`) and `app` (the `ACCOUNT/NAME` ID) as structured fields.

When `ferrite.json` defines no route at `/` (as in the `hello` template), `https://HOST/` returns `404` even after a successful deploy. The CLI prints one `route:` line per configured route (for example, `route: https://HOST/api/`) so you can open a working path directly.

## Find the URL later

Ask your coding agent to call `list_apps` (`remote_list_apps` under `ferrite mcp-serve`) to list every app owned by the active account along with its host and instance counts, or call `describe` (`remote_describe`) for one app's host and deployed artifact.

`ferrite status APP_ID` reports desired and running instance counts without printing the host. Pass either the full `ACCOUNT/NAME` ID or, from inside the project directory, the bare app name from `ferrite.json`.

If `list_apps` omits an app you deployed earlier, you are authenticated to a different account or the app was withdrawn (`ferrite status` answers `no deployment` for a withdrawn app). See [Check which account you are using](/kb/guide/check-which-account-you-are-using/).

## Find a preview URL

`ferrite preview` commits your current source and deploys it to a temporary host of its own. Previews pass the same build and admission checks as regular deploys, skip test holds, cost nothing, and are removed automatically two hours after creation. Because `ferrite preview` prints the `BuildStarted` reply and exits without waiting for the build to finish, follow the returned `build_id` with `build_status` (`remote_build_status`) until `PreviewDeployed` reports the preview's `host`. See [Preview and release verbs](/developers/deployments/#preview-and-release-verbs) for polling details and `delete_preview`. Never share a preview URL as the app's permanent address.

## When a URL stops answering

Check these causes in order:

- Deploying under a different account ID or app name creates a separate app at a different derived host. Check `ferrite account` and the `host:` line from your latest deploy.
- A trial account (`eph-`) expired after 48 hours and its apps were withdrawn. Move apps you want to keep into a durable account before expiry; see [Claim an account your agent created](/kb/guide/claim-an-agent-created-account/).
- The app was withdrawn. `ferrite status` returns `no deployment` and `list_apps` omits it.
- The app runs zero instances, either because it was scaled down or because the prepaid balance reached zero. When a durable account reaches zero, running apps stop and are deleted with their data after 30 days. Adding credit that covers at least one day at the resumed rate (and at least $1.00) restarts each app at its recorded instance count and logs the transitions in `notifications`. Trial accounts cannot be funded and suspend as soon as credit runs out. See [Understand usage and credits](/kb/guide/usage-and-credits/).
- Requests return `402 Payment Required` with the body `prepaid balance exhausted; no lease, no service` because the account cannot fund further requests.

Run `ferrite status APP_ID` (or ask your agent to call `list_apps`) to check desired and running instances. If `ferrite status` or the agent receives HTTP 401, the stored credential was rejected or revoked; see [Connect the CLI to your account](/kb/guide/fix-sign-in-problems/#connect-the-cli-to-your-account). If instances are running and the host still fails to answer, send the Ferrite team the app ID, host, and exact UTC time; see [Report a bug](/kb/guide/report-a-bug/).
