---
title: "Deploy an app from source"
description: "Scaffold a constrained Rust app, run local and remote checks in seconds, estimate cost, and deploy from source with ferrite deploy."
topics: ["deploys", "cli", "constrained-apps"]
updated: 2026-11-16
featured: true
---

To deploy on Ferrite, submit a Rust crate (with `ferrite-app` as its only Cargo dependency) and its `ferrite.json` manifest using `ferrite deploy`. The platform checks your source, compiles it in its own builder, and runs the resulting binary. Because a remote build takes several minutes, run local checks and tests first so you catch policy, manifest, and compile errors in seconds.

## Create and check the app

Scaffold a web app with tests and verify it locally:

```bash
ferrite new webapp hello-ferrite --with-tests
cd hello-ferrite
ferrite check
ferrite test
```

The `webapp` template creates static assets under `site/`, Rust source under `src/`, a smoke test under `tests/`, and `ferrite.json`. Run `ferrite dev` to serve the app locally with live reload and persistent plane state under `.ferrite/state`.

`ferrite check` runs the local source gate, manifest validation, and `cargo check`. Because the local verdict is advisory and the platform's gate decides every deploy, run `ferrite check --remote` before your first deployment. Both remote checks (`code_gate` and `validate_spec`) are free. If your manifest is rejected, see [Why ferrite check rejects your spec](/kb/guide/why-ferrite-check-rejects-your-spec/).

## What the manifest declares

`ferrite.json` lists every capability the platform hands your app: bound services (store, queue, log, APE, object storage), HTTP routes and the headers each route forwards, compute limits, and allowed outbound HTTPS destinations. At runtime, your app receives handles for those declared resources and no others. The source gate rejects code that reaches for the filesystem, processes, network listeners, or environment variables before compilation, and runtime containment enforces that boundary once deployed. See [What bounds your app](/developers/why-it-is-safe/) for exact scope.

Secrets live outside `ferrite.json`. Set each secret with `ferrite secrets set <name>` before deploying and read it in code through `ctx.secret`; see [Secrets & Egress](/developers/secrets-egress/).

Leave `"artifact_sha256"` set to 64 zeros in a new manifest. The platform records the real digest when it builds your source.

## Deploy the app

`ferrite deploy` submits under whichever account `ferrite account` prints, whether that is a durable account (`ferrite login --id <name>`) or a 48-hour trial account (`ferrite login --ephemeral`, starting with $5 of credit and limited to one instance per app at 256 MiB of memory and half a CPU). A trial's apps go offline after 48 hours unless you sign in: to keep them, open the link `ferrite claim --link` prints before expiry and keep the trial or move it into an account you own; see [Claim an account your agent created](/kb/guide/claim-an-agent-created-account/).

Verify the active account, estimate the price, and deploy:

```bash
ferrite account
ferrite cost
ferrite deploy
```

`ferrite cost` (MCP: `estimate_cost`) reports your prepaid balance, the deploy fee, and projected monthly running cost at current rates without building or charging anything. The deploy fee is charged when a submission is accepted and refunded automatically if the build fails; if your balance cannot cover it, the deploy is refused before any build starts and nothing is charged. Refused and failed builds leave zero net charge. Run `ferrite statement` or open **Usage & billing** in the dashboard to review recorded charges. If a durable account's prepaid balance reaches zero, running apps stop and are retained for 30 days before permanent deletion with their data (a trial suspends its apps as soon as its credit runs out; sign in from its claim link to keep it as your own account); see [Understand usage and credits](/kb/guide/usage-and-credits/).

`ferrite deploy` runs the free remote gates first, logs the attempt under `.ferrite/deployments/`, uploads your source, and follows the build (typically several minutes). On success, it prints:

```text
deployed: ready
host: https://HOST/
charged_micros: AMOUNT
```

`HOST` is the HTTPS hostname assigned to your app, and `AMOUNT` is the deploy charge in micros, printed once the platform confirms the desired instances are running the new version. Your deployed app ID has the form `ACCOUNT/NAME`, where `NAME` matches the `name` field in `ferrite.json`. Pass that ID (or the bare name inside the project directory) to `ferrite status` and `ferrite logs`, or pass `--json` to read `app` and `host` directly.

A running instance proves the process started, not that your logic works. Open `https://HOST/` and test the real user path (such as saving a record and reloading).

Re-running `ferrite deploy` when source, manifest, and secrets match the active ready deployment submits nothing and charges nothing. Updating a secret with `ferrite secrets set` counts as a change; pass `ferrite deploy --force` to force a rebuild of identical source (or after setting a secret directly over MCP).

For unverified work on a throwaway URL, run `ferrite preview` instead. Previews pass the same build and admission checks, skip test holds, cost nothing, and are removed automatically two hours after creation.

## If the deployment doesn't succeed

The CLI separates pre-submission gate refusals, failed remote builds, and interrupted attempts whose outcome must be reconciled with `ferrite deploy resume`. Each case needs a different recovery step; see [Fix a failed deployment](/kb/guide/fix-a-failed-deployment/).
