---
title: Withdraw an app
description: Withdraw a Ferrite app permanently, preserve or fork its data first, remove secrets and repositories, and handle custom hostnames safely.
topics: ["deploys", "accounts"]
updated: 2026-11-16
---

Withdrawing an app takes it offline and deletes the resources its deployment created. Withdraw an app only when it should stop existing. To ship code changes, deploy again from the same project. To pause traffic while keeping stored data, ask your agent to call `scale` with `0` instances. Scaling to zero still bills for data reserved by the app's services; only withdrawal stops that charge.

## Keep what you need first

Ferrite has no raw data export tool. To keep an app's data, fork it into a replacement app first as described in [Move to a new app before you withdraw the old one](#move-to-a-new-app-before-you-withdraw-the-old-one).

Before withdrawing an app:

- Keep a copy of the source (for apps deployed with `ferrite deploy`, your local project directory is that copy).
- Read out any data you want to retain through the app's own pages or API while it is still running.
- Record which secret names your app needs with `ferrite secrets list` (or MCP `list_secrets`) if you plan to redeploy it later, because withdrawal removes the app's stored secrets along with its data. To remove secrets manually before withdrawing, run `ferrite secrets delete NAME` or ask your agent to call `delete_secret`.

## What withdrawal removes

Run `ferrite withdraw APP_ID` (pass `--yes` outside an interactive terminal), choose **Settings > Withdraw app** in the dashboard, or ask your agent to call `withdraw`. The platform runs four steps:

1. Cancels any deployment still in progress for that app name, so work started before withdrawal cannot land afterward.
2. Removes the app's routes so its URL stops answering.
3. Marks the deployment record as withdrawn.
4. Deletes the named resources created by the deployment once the app's instances stop.

Withdrawal is free and stops every charge for the app, including charges for data reserved by its services; see [Understand usage and credits](/kb/guide/usage-and-credits/#what-uses-credit). Treat withdrawal as irreversible: the app's routes come down and its secrets and data are removed permanently. Afterward, `list_apps` drops the app and `status` reports `no deployment`. Calling `withdraw` again for the same app succeeds with no effect.

Withdrawal leaves any hosted source repository intact. To remove it, ask your agent to call `delete_repository` for the withdrawn app. That deletes every branch, tag, and named release at once and cannot be undone.

## Move to a new app before you withdraw the old one

To replace an app with a new one at its own host while preserving its data, finish these steps before withdrawing the old app:

1. Create the new app. To carry the old app's data over, fork the app while it is running: run `ferrite fork NEW_NAME` from the project directory, or ask your agent to call `fork` with `app` and `fork_app`. A fork launches a new app at its own host with the old app's code and a point-in-time copy of its data while the old app stays online. `ferrite fork` waits until the fork deploys, then prints its host and one status line per bound service. Add `--as-of` with a timestamp within the last 14 days to copy an earlier state; the platform refuses and explains why if a service no longer retains history from that time. To start without the old data, set a new `name` in `ferrite.json` and deploy to create a new app and host.
2. Check the status on each service line from the fork output. `forked` means an independent copy. `empty` means the fork's service started empty: read that data from the old app's pages or API while it is still running and write it into the new app. `shared` means the fork points at the same underlying data as the old app; do not withdraw the old app until the Ferrite team confirms what withdrawal does to that data. Writes to the old app after the fork cut are not copied, so move clients soon after forking.
3. To edit the fork's code or manifest, copy the project directory without `.ferrite/` and `target/`, set `name` in `ferrite.json` to the fork's name, and keep the service names unchanged. Deploying from that copy preserves the forked data.
4. Set the new app's secrets before deploying: run `ferrite secrets list` and `ferrite secrets set` from the directory whose `ferrite.json` names the new app. Those commands target the new app even before its first deployment. Secrets belong to one app and are not copied into a fork, so `ctx.secret` returns `None` until you set them and deploy. Run `ferrite deploy` once afterward; secrets changed with `ferrite secrets` count as a deployment change, so `--force` is needed only if a secret was updated another way, such as with `set_secret`. A trial account can hold secrets for at most 8 app names that have never been deployed. See [Replace an app secret](/kb/guide/respond-to-an-exposed-credential/#replace-an-app-secret).
5. Move clients to the new host. If a custom hostname is bound to the old app, rebind it to the new app with `ferrite domains add HOSTNAME --app NEW_APP` (or MCP `bind_domain`) and verify it serves the new app with `ferrite domains check HOSTNAME` before withdrawing the old app. If `ferrite domains check` still routes to the old app or reports an error, keep the old app running and email the Ferrite team; see [Custom domains and TLS](/kb/guide/custom-domains-and-tls/).
6. Withdraw the old app only after confirming you have everything you need from it and verifying that any moved custom hostname serves from the new app.

If you cannot move the data yourself, email the Ferrite team with both deployed app IDs before withdrawing anything; see [Get help from the Ferrite team](/kb/guide/get-help-from-the-ferrite-team/).

## Change an app's routes, services, or resources

Deploying the same project with an edited `ferrite.json` updates the existing app at the same host, because `deploy_source` targets `ACCOUNT/NAME`. What a deployment does to stored data when you remove or rename a service in the manifest is not documented, so treat that data as at risk and read out anything you need through the app's pages or API before deploying that change.

## Delete a preview

A preview expires two hours after creation. To remove one sooner, ask your agent to call `delete_preview` with the `preview_app` ID that `build_status` returned when the preview deployed. See [Preview and release verbs](/developers/deployments/#preview-and-release-verbs).

## Close an account

Ferrite has no tool to delete an account. Withdraw every app on the account to stop running workloads and charges. To close the account itself, email the Ferrite team with the account ID; see [Get help from the Ferrite team](/kb/guide/get-help-from-the-ferrite-team/).
