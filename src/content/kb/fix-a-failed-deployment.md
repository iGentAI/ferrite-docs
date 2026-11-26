---
title: Fix a failed deployment
description: "When ferrite deploy does not finish with deployed: ready, match the last lines of output to the exact recovery step before submitting again."
topics: ["deploys", "cli"]
updated: 2026-11-16
featured: true
---

`ferrite deploy` runs the platform's free gates against your source first. If they pass, it journals an attempt under `.ferrite/deployments/`, uploads your source, and follows the build to completion.

When a deploy does not finish with `deployed: ready`, match the final lines of output to the sections below. Do not rerun `ferrite deploy` on unchanged source, and never start a second deploy while an attempt is unresolved: `deploy_source` is not idempotent, so a second submission starts a second build and charges a second fee.

When the CLI prints a quoted command such as `resume: "ferrite deploy resume --attempt ATTEMPT_ID --json"`, copy only the text inside the quotation marks.

## Refused before submitting

```text
refused before submitting: the platform's free gates found violations
no build started, nothing was charged, and no attempt was journaled
submit anyway with `ferrite deploy --skip-remote-gate`
```

The violations appear earlier in the output. Work through them in order:

1. Run `ferrite explain CODE` for each violation code, such as `CODE_DEP_UNLISTED`. If `explain` does not recognize a code, ask your agent to call `explain_gate` with it, or see [Why ferrite check rejects your spec](/kb/guide/why-ferrite-check-rejects-your-spec/).
2. Make the smallest edit that fixes the first violation.
3. Run `ferrite check --remote` to recheck your source against the platform without deploying.
4. Run `ferrite deploy` again.

`--skip-remote-gate` bypasses only the free preliminary check. The build applies the exact same rules, so it fails on the same violation.

`CODE_DEP_UNLISTED` means `[dependencies]` in `Cargo.toml` names a crate other than `ferrite-app`, and no flag overrides that rule. Replace the crate with a source package from `ferrite add` or with code in the app itself. See [The one-dependency rule, explained](/kb/guide/one-dependency-rule-explained/).

The CLI can also stop before calling the platform's gates. Those messages start with `refused before submitting:` plus a reason, end with the same `no build started` line, and omit `--skip-remote-gate`. Pass `--json` to read the refusal `code`:

| Code | Cause and fix |
| --- | --- |
| `DEPLOY_MANIFEST_KEYS_REFUSED` | `ferrite.json` carries a key the platform refuses or the CLI holds, such as `auth`, `stream_mode`, or `rate_limit_per_min`. Follow the `instead:` line printed for each key. `--drop-auth` and `--drop-stream-mode` strip those two keys; dropping `auth` publishes the app without its sign-in gate. |
| `DEPLOY_REQUIRED_SECRETS_MISSING`, `DEPLOY_AUTH_SECRETS_MISSING` | A secret required by the manifest or the `auth` package is unset. Set each one with `ferrite secrets set` and redeploy. `--allow-missing-secrets` submits anyway, and the app can fail at runtime. |
| `APP_CARDINALITY` | `ferrite.json` must declare exactly one application. Deploy each application from its own manifest. |
| `DEPLOY_MANIFEST_INHERITS_WORKSPACE` | `Cargo.toml` inherits fields from a Cargo workspace root that the remote builder does not have. Inline those fields into the app's own `Cargo.toml`. |
| `APP_IDENTITY_CONFLICT` | This project previously targeted a different app ID, and this run would create or update another app. Check the earlier app ID named in the message and verify the active account. |

## Nothing was submitted

When your source, manifest, and secrets match the ready deployment currently served, `ferrite deploy` prints the host and ends with `nothing was submitted and nothing was charged`. That is a clean no-op.

Run `ferrite deploy --force` to rebuild identical source, for example after updating a secret through the MCP `set_secret` tool (which the local CLI cannot detect).

## Deployment failed

```text
deployment failed: "STATE"
reasons reported by the platform (COUNT):
  - REASON
```

`STATE` is the attempt's final state, `COUNT` is the number of reasons, and each `REASON` is a compiler error or a platform refusal. The CLI saves the same reasons in `.ferrite/deployments/`. When the output includes `nothing was charged`, the platform reported no fee; confirm with `ferrite statement` or `account_statement` if you need to check.

Fix the first reason in your source, run `ferrite check` and `ferrite test` locally, then run `ferrite deploy` again. Local checks catch compiler and manifest errors in seconds; a remote build takes minutes.

### The build landed, but the app doesn't stay up

State `"landed_crash_looping"` (`DEPLOY_LANDED_CRASH_LOOPING`) means the build succeeded and registered, but the app process keeps exiting. The reasons report the generation along with running and desired instance counts; `--json` also includes the host and `logsCommand`.

Run `ferrite logs APP_ID` to inspect process output, fix the crash, and redeploy. If the process exits before flushing any output, run `ferrite dev` locally to see the failure directly.

The platform parks apps whose instances crash-loop. While parked, `rollback`, `scale`, and further deploys return `ParkedMutationRefused`. To bring a parked app back without a new build, fix the root cause and ask your agent to call `resume` (or its `retry_park` alias where exposed); the platform re-admits the app against your current balance and quotas.

## Requires reconciliation

Exit status `3` with output ending like this:

```text
deployment requires reconciliation: "CODE"
resume: "ferrite deploy resume --attempt ATTEMPT_ID --json"
```

The CLI could not confirm the submission's outcome, for example after a lost network reply (`DEPLOY_SUBMIT_UNKNOWN`). Because `deploy_source` is not idempotent, submitting again would start a second build and charge a second fee.

From the same project directory, run the command inside the quotation marks on the `resume:` line. It checks the app's source log first and then the account statement, and it never submits again.

A build normally appears in the source log right away. The exception is source identical to the previous deployed commit, which shows up only in the account statement once charged. If `resume` exits with status `3` again, wait a few minutes and rerun it. Thirty minutes after the attempt was journaled, `resume` closes an unmatched attempt as never observed.

Until the attempt resolves, do not edit your source, switch accounts, delete `.ferrite/deployments/`, or start another deployment for the same app.

## Interrupted before a result

If your terminal closed, an agent's shell timed out, or you cancelled the command, the build may still be running on the platform. The CLI waits up to 20 minutes for a build, so set any agent shell timeout to at least 20 minutes when running `ferrite deploy`.

Look for the attempt ID on the line `deploy attempt ATTEMPT_ID journaled; submitting once`, then run from the project directory:

```bash
ferrite deploy status --attempt ATTEMPT_ID
ferrite deploy wait --attempt ATTEMPT_ID
```

`status` fetches a single snapshot; `wait` follows the attempt until it is ready or fails. If you lost the attempt ID, run `ferrite deploy resume` without `--attempt` to target the latest unfinished attempt in the project. Attempt IDs and build IDs are different values; do not pass one where the other is expected.

To abort an in-flight deploy (for example, one waiting on capacity), read `buildId` from `ferrite deploy status --attempt ATTEMPT_ID --json` and ask your agent to call `cancel_deploy` with it. State `cancelled` confirms nothing landed, any fee is refunded, and the running app is untouched. State `deployed` means the build finished before the cancellation took effect.

## Run from the wrong directory

The deployment journal lives inside the project directory, so `ferrite deploy status`, `wait`, and `resume` must run from the directory where you ran `ferrite deploy`, or pass `--dir PATH`.

In a directory without `Cargo.toml`, the CLI reports it missing and suggests `ferrite new` (`--json` code: `DEPLOY_LOCAL_STATE_INVALID`). In a project with no unfinished attempt, `resume` asks for `--attempt`. Change back to the original project directory or pass `--dir` and rerun; starting a new project will not recover an existing attempt.

## The platform rejected the credential

If `ferrite deploy` fails with `MCP HTTP 401 Unauthorized: this login is not known to the platform at <endpoint>` (or, on bare 401s or older CLIs, `the platform did not accept the credential this request carried`), nothing was submitted and your source is untouched.

After a platform release, accounts from the previous installation no longer exist; see [Sign-in stopped working after a platform release](/kb/guide/sign-in-stopped-working-after-a-platform-release/). For expired, revoked, or mismatched credentials, see [Connect the CLI to your account](/kb/guide/fix-sign-in-problems/#connect-the-cli-to-your-account).

## The balance can't fund the deployment

The platform checks your balance before starting a build. If your balance cannot cover the deploy fee, `ferrite deploy` exits with status `1` with `INSUFFICIENT_CREDIT` in CLI output (and `InsufficientCredit` in MCP, carrying `have_micros`, `need_micros`, and `how_to_pay`). Those fields report your current balance and the required fee.

Ask your agent to call `billing_portal` to get a top-up link for the account owner. Trial accounts cannot be funded; move their apps to a durable account ([Claim an account your agent created](/kb/guide/claim-an-agent-created-account/)) or deploy from a durable account instead.

Because no build started and nothing was charged, add credit and deploy the same project again. Check fees ahead of time with `ferrite cost` (or `estimate_cost`), and inspect your balance with `ferrite statement`. See [Understand usage and credits](/kb/guide/usage-and-credits/).

## Deploying from a trial account

`ferrite login --ephemeral` creates a trial account (shown as a temporary account in the CLI, with an ID starting with `eph-`). It deploys directly under fixed caps:

- 48-hour lifetime, after which the account expires and running apps are withdrawn
- $50 starting credit, which is also the hard spending cap (no top-ups)
- 1 instance per application, 256 MiB memory, 0.5 CPU
- 32 MiB maximum source upload

Ask your agent to call `estimate_cost` to inspect these caps and expected charges. When a refusal names one of these caps, you hit a trial limit; move to a durable account, which has no 48-hour limit.

## Deployed, but the app doesn't work

`deployed: ready` confirms the platform built your code and started the desired instances without platform errors. It does not exercise your routes or handlers.

1. Open the URL from the `host:` line and repeat the failing request.
2. Run `ferrite status APP_ID`, where `APP_ID` is `ACCOUNT/NAME` (or the bare name from `ferrite.json` when inside the project directory; ask your agent to call `list_apps` if you need to look it up). If `status` reports `no deployment`, check the ID. If `last_error` shows placement is pending, a worker has not started the app yet; check again in a minute.
3. Run `ferrite logs APP_ID` to read recent output. See [Read app logs safely](/kb/guide/read-app-logs-safely/).

## Ask for help with a deployment

If none of the steps above clear the failure, send the Ferrite team the attempt ID, the deployed app ID (if created), and the reasons the CLI printed. See [Report a bug](/kb/guide/report-a-bug/) for the full checklist.
