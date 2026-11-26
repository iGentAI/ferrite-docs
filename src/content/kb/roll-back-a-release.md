---
title: Roll back a bad deployment
description: Restore the previous build of a Ferrite app with rollback or rollback_release, verify live traffic, and isolate the regression afterward.
topics: ["deploys"]
updated: 2026-11-16
---

A deployment can pass every check and still break a workflow your users depend on. Put the previous artifact back in service first, then debug the regression offline. Ferrite keeps the artifact that ran immediately before the latest deployment, so `rollback` restores it without rebuilding.

After a platform release there is no prior artifact on the new installation; deploy again from source using [Prepare for a platform release](/kb/guide/prepare-for-a-platform-release/).

## Roll back to the previous artifact

Ask your coding agent, or any MCP client signed in to the account, to call `rollback` with the deployed app ID. The CLI has no rollback command.

During the switch, the worker boots the previous artifact alongside the live one and moves traffic over only after the restored instance passes its health check. The app stays available through the rollback.

Two limits apply to `rollback`:

- `rollback` toggles between the last two artifacts. Calling it a second time does not step further back; it returns to the artifact you rolled back from.
- Rolling back swaps the running artifact only. It does not revert writes the broken build made to stored data or external services; clean up bad records or sent messages separately.

If crash-looping caused the platform to park the app, `rollback` returns `ParkedMutationRefused`. Deploy a fixed build from source, or resolve the underlying failure and ask your agent to call `retry_park`. See [Fix a failed deployment](/kb/guide/fix-a-failed-deployment/#the-build-landed-but-the-app-doesnt-stay-up).

If `rollback` refuses because no previous artifact exists, or if the restored artifact fails as well, deploy a fix from source and send the Ferrite team the app ID, the tool response, and the UTC time. See [Report a bug](/kb/guide/report-a-bug/).

## Roll an environment back to a named release

When you deploy through named releases and environments, you can restore any earlier release in that history.

Ask your agent to call `releases` and `deploy_history` to inspect available releases and what ran in the environment, then call `rollback_release` with the app, the environment, and the target release. Unlike `rollback`, `rollback_release` deploys the earlier release again: it returns a build ID, and your agent polls `build_status` for several minutes until the build is live. The rollback is recorded as a new entry in `deploy_history`; the bad release stays in the log.

If production traffic cannot wait and the immediately preceding artifact is the one you want, `rollback` cuts over faster. It only swaps the running artifact and writes no event to `deploy_history`.

If you deploy directly with `ferrite deploy` and have not created named releases, `releases`, `deploy_history`, and `environments` stay empty. Use `rollback` instead.

## Confirm that the app works

Verify the app after the rollback completes:

1. Run `ferrite status APP_ID`, where `APP_ID` is the deployed app ID from `list_apps`, and confirm that the expected instances are running.
2. Open the app URL and run through the workflow that broke.
3. Run `ferrite logs APP_ID` and inspect the tail for errors after the cutover.

## Fix the change

Reproduce the failure locally with `ferrite dev`, add a test that catches it, and fix the source.

If the failure depends on live data or does not reproduce locally, ask your agent to call `fork` on the app. A fork launches a separate app at its own host with the same code and a copy of the data, so you can debug there without touching live traffic. Like a deploy, `fork` returns a build ID for your agent to poll with `build_status` until live. Withdraw the fork once you are done.

Run `ferrite check` and `ferrite test`, then deploy the fix. See [Scaling & Releases](/developers/scaling-releases/) and [Fix a failed deployment](/kb/guide/fix-a-failed-deployment/) for related workflows.
