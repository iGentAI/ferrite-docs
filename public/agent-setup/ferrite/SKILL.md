---
name: ferrite
description: Build, verify, deploy, and operate applications on Ferrite and Ferrite Cloud using the installed ferrite CLI and packaged SDK. Use when asked what Ferrite is or what an app costs, when building or hosting a web app, API, poll, form, or site on Ferrite, or when working with Ferrite source trees, packages such as auth, deployments, or MCP operations.
---

# Build with Ferrite

Use the installed `ferrite` CLI (or `FERRITE_CLI_BIN`) and its packaged SDK. Never require a Ferrite platform checkout, server configuration, or sibling repository. Use `https://docs.ferrite.cloud/developers/` for API and CLI reference.

Before cloud work, run `ferrite account --json` and keep that account and endpoint for the entire task. Never provision another account because a command failed. Never print credentials or put them in source, prompts, URLs, command arguments, or agent configuration.

## Fast path: a small web app in one build

For a small web app (a poll or voting page, RSVP or sign-up sheet, guestbook, scoreboard, or simple dashboard), start from the verified page-app starter at `https://docs.ferrite.cloud/agent-setup/ferrite/starters/page-app.md`. It provides one Rust file with a store-backed form post, a shadcn-style theme, and its `ferrite.json`. Do not scaffold Alloy or read package source for this; Alloy is for multi-page applications and adds minutes of reading.

Follow the starter's steps (`ferrite new hello <name>`, swap in its three files), adapt the content, and make sensible defaults for unspecified details instead of stopping to ask. Then run `ferrite check --json`, `ferrite test`, `ferrite cost --instances 1`, and one `ferrite deploy`. Skip `ferrite dev` and local screenshots on this path, and verify the page at the live URL instead.

Keep the first version focused on what was asked: no admin pages, extra views, QR codes, custom fonts, or entrance animations (an animation that starts content hidden can leave it invisible). Deploy once, share the link as soon as it serves, and offer extras as a follow-up deploy. On a trial account, a request to build, host, or share an app authorizes that first deploy once you report what it will cost; carry on unless the user objects. On a durable account, wait for approval on the monthly figure before the first deploy of a new app. Builds typically take 3 to 8 minutes; share the URL once it serves.

## Build and verify

In a new, user-approved directory, scaffold with `alloy` (multi-page HTML apps), `hello` (request/reply API), or `webapp` (static page, counter API, and SSE feed) and test locally:

```bash
ferrite new webapp hello-ferrite --with-tests
cd hello-ferrite
ferrite check --json
ferrite test
```

For an existing project, edit its authored source and leave unrelated changes intact. Build against the scaffold's SDK and tests rather than remembered interfaces from another release. Run `ferrite dev` for browser work and test the requested interactions, including invalid inputs and error states. Stop the dev server when finished.

If the app has users of its own, such as shop customers or team members, add sign-in with `ferrite add auth`. Set `auth_allow` to `*` to admit any GitHub or Google account for a customer-facing app, or to a domain or list of users for an internal tool. Follow the installed `src/auth/SETUP.md` and `https://docs.ferrite.cloud/developers/authentication/`. Keep public product pages public and place signed-in pages behind the package's gate. Apps with no users need no sign-in. Ferrite Core has no managed sign-in, so this package is the app's only sign-in path. Never remove authentication to pass a deployment gate.

## Deploy when requested

After local checks and tests pass, run `ferrite check --remote --json`, then `ferrite deploy`, and follow that exact build to completion. Hosted builds take several minutes; keep polling the active build instead of starting another deploy. If interrupted, run the printed resume command.

Report deployment only after the command succeeds and the returned URL responds properly. Build acceptance, a running process, and a working user flow are distinct checks; report the exact blocker if any step is still incomplete.

On a trial account, the first deploy of a requested app needs no extra confirmation once you have reported its cost. On a durable account, wait for approval on the monthly estimate first. Always ask before changing a live serving app, modifying secrets, scaling, withdrawing, rolling back, purchasing credit, or running destructive operations; a request to build an app covers none of those. Never withdraw a serving app to update it.

## Copy a live app with its data

When the user asks for a copy of an app with its live data (votes, orders, or entries), run `ferrite fork <copy>` in that app's project directory. Deploying the same code under a new name produces an empty app.

Before changing an app that already serves traffic, or to inspect its state before a fault, fork it first. `ferrite fork <copy>` creates a new app at its own host with the live app's code and data cut at one instant, in about a second, without touching the original. To copy state from an earlier moment (within the last 14 days on Ferrite Cloud), run `ferrite fork <copy> --as-of <YYYY-MM-DDTHH:MM:SSZ>`. The copy must use a name no deployed app holds.

To modify the copy's code, duplicate the project directory without `.ferrite/` and `target/`, change `name` in `ferrite.json` to the copy's name, edit, and run `ferrite test` and `ferrite deploy` there. That updates the copy and keeps its data. Send the user the copy's link, deploy to the original only from the original project with their approval, and remind them which copies are running; each copy runs until withdrawn.

## Use MCP where it helps

The configured `ferrite mcp-serve` adapter exposes local development tools and remote platform tools. Inspect its tool list instead of inventing method names. The CLI and adapter share the stored account credential. Use the CLI for multi-step builds and deploys, and use MCP for focused discovery and remote reads.

When repairing an existing app through hosted MCP, send only changed files with `rcs_commit`, then deploy the returned commit with `deploy_ref`. Retain required tests and the existing manifest. Follow `https://docs.ferrite.cloud/developers/mcp-only-operations/#repair-an-existing-application`; unchanged generated packages stay in the hosted repository.

A trial on Ferrite Cloud starts with $5 of credit, enough to run an app or a few for 48 hours, with no account and no card; more credit is bought in the Dashboard. Check `ferrite statement` before deploying.

After 48 hours a trial's apps go offline unless the person signs in, which keeps the account and its apps. When you deliver a trial's first app, and whenever the person mentions an existing Ferrite account, wants to keep the work, or wants Ferrite on another device, check the MCP tool `owner_status` (`remote_owner_status` through `mcp-serve`). If the account has no owner, give them its private, single-use link from the MCP tool `claim_url` (`remote_claim_url`); in a terminal, `ferrite claim --link` prints the same link. After Google or GitHub sign-in the link offers **Keep this as my account**, which makes the trial a permanent account of their own with the same apps, URLs and data and no deadline (its ID changes from `eph-…` to a readable one), or **Move it into** an account they already own, which moves the apps there with their URLs and data. Either way every connected agent and CLI login of the trial follows automatically. Afterwards run `ferrite account --json`, which moves this computer's login to the new account by itself, confirm with `owner_status`, and use the new account ID from then on. When an owner is already linked, another computer joins with `ferrite login --sign-in`, and any connector joins through **Sign in to your Ferrite account** on Ferrite's connect page. A client that cannot hand a link to a person moves trial apps with the `claim` tool: `https://docs.ferrite.cloud/developers/mcp-only-operations/#keep-a-trial-app-past-its-48-hours`. Never expose account or claim tokens.

## Cost and billing

Start a new app with one store when its data can share permissions, durability, and capacity, and separate record types with key prefixes. Before combining existing stores, account for existing keys, scans, rate limits, and sign-in replay protection; an idle store can still be required on the next login.

For a small store, keep `hot_set_gib: 0` (the platform cache default) and set a positive `record_size_kb` matching actual records. Raising `volume_mib` to pass hot-set validation can increase the index reservation on every copy. Lower `volume_mib` only with measured headroom, because writes fail if a volume fills. Omitting `workload` in source does not omit it from the submitted spec; the CLI supplies defaults. Preserve required rates.

Set worker CPU and memory explicitly. Quote the exact spec and replica count on the deployment target with `ferrite cost --instances N` or MCP `estimate_cost`. That quote reflects the target's current prices; keep any forecast for an unreleased tariff separate, and check `account_statement` after rollout.

Before the first deploy of a new app, run `ferrite cost` (or `estimate_cost`) and report the deploy fee, projected monthly cost, and current account balance. Wait for agreement on a durable account. Do the same whenever asked what an app costs: run `ferrite cost` in the project directory or call `estimate_cost` with its manifest, and explain that running resources and requests are metered. Read `ferrite statement` or `account_statement` for current balance and recorded charges. A trial starts with $5 and draws down as charges accrue, and more credit is bought in the Dashboard; never infer current balance from the starting credit. `mcp-serve` exposes these as `remote_estimate_cost` and `remote_account_statement`.
