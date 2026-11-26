---
kind: lesson
course: ferrite-foundations
title: What happens during a deploy
description: "How ferrite deploy validates source, records a local deploy journal, compiles on the platform, handles interruptions, and preserves application state."
order: 5
---

Shipping backend code over an ordinary network creates two classic failure modes: uploading an opaque binary the host cannot inspect, and dropping a connection mid-flight so you have no idea whether retrying will start a duplicate build. `ferrite deploy` avoids both by compiling verified source inside Ferrite's own builder and recording every attempt locally before anything is sent to the platform.

A deploy moves through four stages:

1. The CLI runs the platform's admission check against your source and manifest. You can invoke the same remote check without deploying by running `ferrite check --remote`. Passing `--skip-remote-gate` bypasses this upfront check (which carries no fee), though the platform builder still runs the gate and enforces its verdict before admitting the build.
2. The CLI writes the attempt into the project's local deploy journal under `.ferrite/deployments/`, and only then submits the source to the selected account. Writing the journal first guarantees that an interrupted upload leaves a concrete attempt ID you can reconcile later.
3. The platform compiles the crate inside its own builder. Because the platform builds from checked source itself, a deploy typically takes three to eight minutes while the CLI streams progress.
4. Once the build passes admission and the application starts, the CLI prints the deployed host. The platform assigns that host automatically as the application's public URL.

## Cost checks, hosts, and deduplication

Ferrite bills against a prepaid balance at metered rates and lets you check the cost before committing to a build. Run `ferrite cost` in the project directory, or have an agent call `estimate_cost`, to inspect the account balance, the deploy fee, and each application's projected monthly spend at current rates. Estimating cost deploys nothing and charges nothing. If the account balance cannot cover a deploy, the platform refuses it before starting a build and charges nothing; failed or refused builds carry no charge either. The CLI reports a balance refusal with `INSUFFICIENT_CREDIT`, and MCP returns `InsufficientCredit`. See [Understand usage and credits](/kb/guide/usage-and-credits/) for how balances and usage metering work.

The `name` field in `ferrite.json` identifies the application inside its account, separate from its public URL. Because the platform derives the host deterministically from the account and application name, `ferrite host` can print the URL before your first deploy, marked `derived` until the platform confirms it.

When a project has not changed since the build the platform is currently serving, `ferrite deploy` submits nothing, skips the build, and charges no deploy fee. The CLI determines this from its local journal. Calling `deploy_source` directly over MCP skips that local comparison: every direct MCP call starts a new build and incurs a deploy fee. Pass `--force` to `ferrite deploy` whenever you want a fresh build of unchanged source.

Secrets reach a running application only through a deploy. Updating a secret with `ferrite secrets` marks the project as changed in the local journal, so the next `ferrite deploy` triggers a build even when source files are untouched. Changing a secret outside the CLI, such as through the platform's `set_secret` MCP tool, does not update that journal; run `ferrite deploy --force` to deliver it. In either case, delivering a secret runs a full build and incurs a deploy fee.

Before uploading, the CLI builds a clean projection of `ferrite.json` and `Cargo.toml` shaped for the platform's parser and builder (for example, removing `[lints] workspace = true` from `Cargo.toml`). It prints every edit it applies, stages the projected files under `.ferrite/upstream-projection/`, and leaves your working files untouched.

## Interrupted deploys

Closing your terminal or losing network connectivity mid-deploy does not cancel the remote build. Avoid running `ferrite deploy` a second time to check on it. Reconnect to the recorded attempt through the journal:

```bash
ferrite deploy status --attempt ATTEMPT_ID
ferrite deploy wait --attempt ATTEMPT_ID
ferrite deploy resume --attempt ATTEMPT_ID
```

Substitute the attempt ID printed when the CLI submitted your source. `status` reads the current state once, `wait` blocks until the attempt reaches a terminal result, and `resume` settles an attempt the CLI did not finish. Both `status` and `wait` require `--attempt`. Calling `resume` without `--attempt` picks the latest unfinished attempt in the project.

How `resume` behaves depends on how far the original command got before stopping. If the source upload may already have reached the platform, `resume` operates read-only: it checks the application's source log and then the account statement, and attaches to the running build if it finds one. That prevents accidentally triggering a second build and a second deploy fee. If the CLI stopped before transmitting anything, `resume` submits the recorded journal snapshot, and it refuses to proceed if the working tree has changed since the attempt was recorded. Leave the project files alone until the attempt completes; while an attempt remains open, the CLI blocks any new deploy of the same project.

For scripts and CI pipelines, `ferrite deploy --detach --json` prints the attempt record as JSON and exits immediately, and `ferrite deploy wait --attempt ATTEMPT_ID --json` follows that attempt to completion.

## After the deploy

Open the printed host and verify the behavior you changed, the way [Build a booking app with Alloy](/academy/ship-an-alloy-app/) exercises a booking and a full class. From there, inspect the running instance with the operational commands:

```bash
ferrite status yoga-studio
ferrite logs yoga-studio
```

If a new build misbehaves in production, call the platform's `rollback` tool through MCP to restore the previous build. `rollback` toggles between the last two builds, so invoking it a second time moves back forward. Rollback is an MCP operation with no CLI subcommand; [Roll back a bad deployment](/kb/guide/roll-back-a-release/) walks through the steps.

When you want to test work in progress on a real host, run `ferrite preview`. It commits your current source and deploys it to an isolated host of its own. A preview goes through the same build and admission gate as a standard deploy, except it does not wait for a test verdict, carries no charge, and does not count as a release. The platform removes each preview automatically two hours after creation, which makes previews useful for inspecting changes whose tests are still failing. `ferrite preview` starts the remote build and prints the platform response without waiting for completion. See [Preview and release verbs](/developers/deployments/#preview-and-release-verbs) for following a preview build to its host and using `delete_preview` to tear one down early.

## What a deploy keeps

Deploying replaces your application's compiled code, keeps its assigned host, and preserves all stored application data. A platform release is a separate operational event; see [Prepare for a platform release](/kb/guide/prepare-for-a-platform-release/) for how those differ.

For full deployment workflows and options, continue to [Deployments](/developers/deployments/).
