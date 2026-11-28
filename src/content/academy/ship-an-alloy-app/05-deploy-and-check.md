---
kind: lesson
course: ship-an-alloy-app
title: Deploy the studio and check it
description: "Confirm the target account, estimate deployment cost, pass the remote admission gate, deploy the studio, and verify persistence and 409 refusals on the live host."
order: 5
---

Local tests exercise your capacity rule against an in-process harness where
services live in memory and the remote admission gate never runs. Deploying
compiles the crate on the platform, puts it behind Ferrite's ingress gateway,
and backs `bookings` with persistent APE storage. You are done when a booking
survives a page reload on the live host and a request against a full class
returns `409 Conflict`.

## Confirm the account

Check the active CLI login before submitting anything that spends credit:

```bash
ferrite account --json
```

The command prints the active account ID and MCP endpoint without exposing
credentials. If the output names the wrong account, fix the login as covered
in lesson 1 before continuing. Do not run `ferrite login --ephemeral` to work
around a mismatch. That command provisions a separate trial account (labeled
a temporary account by the CLI) that expires after 48 hours and replaces your
stored login.

### The studio is public

The deployed booking page requires no sign-in. Anyone with the URL can book a
seat under any name until each class hits capacity, and every request draws on
your prepaid balance. Because `ferrite.json` declares no request budget,
nothing caps inbound traffic below the gateway's 1,024 waiting-request limit. To cap total requests per route across all
callers, add the `http-route-budget` package and invoke it from Alloy's
`request_budget` hook before handlers run; per-caller limits remain
application code. See [Rate limits](/developers/rate-limits/) for the package
setup. An open form works for this walkthrough, while a live studio taking
real bookings needs customer sign-in, covered in the extension projects at the
end of the course.

When a durable account's balance reaches zero, its applications stop. They
stay suspended for 30 days and are then deleted along with their data, which
cannot be recovered. A trial account's apps suspend if its credit runs out, and
they go offline when the 48-hour window ends unless you signed in through the
trial's claim link beforehand to keep them. See
[Understand usage and credits](/kb/guide/usage-and-credits/) for balance rules
and account tiers.

## See the cost before you deploy

Run `ferrite cost` from the project directory, or have your coding agent call
`estimate_cost`. The reply reports your current balance, the deploy fee, and
the projected monthly cost per application at current installation rates. It
submits no build and charges nothing.

Billing runs against a prepaid balance. If the balance cannot cover the deploy
fee, the platform rejects the deploy before compilation starts and charges
nothing; refused or failed builds also carry no charge. The CLI surfaces that
refusal as `INSUFFICIENT_CREDIT`, and MCP returns `InsufficientCredit`.

The studio manifest requests 256 MiB of memory and half a CPU per instance,
which fits within a trial account's compute cap. Every deployment that builds
draws the deploy fee shown in the estimate. Treat the monthly figure as a
projection at current rates; your prepaid balance is the hard ceiling on
spend.

## Run the remote check and deploy

Running the platform's admission gate first separates a free refusal from a
charged build:

```bash
ferrite check --remote
ferrite deploy
```

`ferrite deploy` runs that same gate automatically before starting compilation.
When the remote gate rejects code that passed locally, the output names a gate
code; see
[What the gate refuses](/academy/ferrite-foundations/what-the-gate-refuses/)
for how those checks differ.

`ferrite deploy` uploads the source archive, prints an attempt ID, and streams
progress while the platform compiles the crate. Builds typically take three to
eight minutes. Once the new revision passes health checks, the CLI prints the
assigned address as `host: https://APP_HOST/`. That hostname stays fixed
across subsequent deploys of the same app.

If neither source nor secrets changed since the currently served deployment,
`ferrite deploy` skips submission and charges nothing. Updating a secret with
`ferrite secrets` counts as a change because secrets reach the running process
through a deploy. See
[What an app can reach](/academy/ferrite-foundations/what-an-app-can-reach/)
for the one case that requires `ferrite deploy --force`.

If your terminal closes or the deploy command times out, do not run
`ferrite deploy` again. Rejoin the in-flight attempt:

```bash
ferrite deploy wait --attempt ATTEMPT_ID
```

Replace `ATTEMPT_ID` with the ID printed at submission. To poll the attempt
state once without blocking, run `ferrite deploy status --attempt ATTEMPT_ID`.

## Check the deployed studio

Open the assigned URL in a browser and verify four behaviors against the live
host:

1. Confirm that all three classes appear with every space open. The deployed
   app runs on fresh platform storage, separate from local `.ferrite/state`.
2. Book the Yin class under any name. The page confirms the reservation and
   updates the count to `1 of 2 spaces left`.
3. Reload the page and verify that `1 of 2 spaces left` persists.
4. Book the remaining Yin space, then send one more booking directly to the
   JSON API:

   ```bash
   curl -i -X POST APP_URL/api/bookings \
     -H "content-type: application/json" \
     -H "idempotency-key: deployed-try-1" \
     -d '{"class_id":"sat-1100-yin","name":"Chloe"}'
   ```

   Replace `APP_URL` with the printed URL without a trailing slash, such as
   `https://APP_HOST`. The endpoint returns `409 Conflict` with the
   `class-full` problem document.

Inspect deployment status and recent process output from the project
directory. Both commands resolve the app from the local deployment record, so
the bare app name works without the full app ID, and `ferrite logs` prints
recent stdout and stderr:

```bash
ferrite status yoga-studio
ferrite logs yoga-studio
```

If either the page or the API behaves unexpectedly, keep the attempt ID and
assigned URL and check
[Troubleshooting and next steps](/academy/ship-an-alloy-app/troubleshooting-and-next-steps/).
