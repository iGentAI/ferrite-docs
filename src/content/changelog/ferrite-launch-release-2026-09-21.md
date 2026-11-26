---
title: "Ferrite developer preview"
date: 2026-09-21
docLink: /developers/quickstart/
authors: ["Ferrite Team"]
---

Ferrite's developer preview brings source deployment, managed application
resources, account controls, and model access into one workflow. Access depends
on the hosted instance's admission policy. An admitted account can connect a
coding agent and follow the documentation or Dashboard quickstart.

The September 20 qualification ran in local Docker with CLI 0.1.6, on a Core
line that Ferrite has since replaced. Its record does not cover the Core or
the CLI that Ferrite uses now. These notes describe that
release; they do not announce a public rollout.

## What you can do

This release includes the following:

- **The quickstart.** Start from the
  [quickstart](/developers/quickstart/) or from **Create your first app** in
  the dashboard's Getting started panel. Both start the same task for Claude
  Code, Codex, or Cursor; the dashboard's copy is filled in for your account.
  The prompt has your agent create a live-counter application, run
  its checks and tests, ask you to confirm the deployment, and verify that a
  saved increment survives a reload.
- **The Ferrite CLI** for macOS on Apple silicon and x86-64 Linux (glibc 2.34
  or newer). The
  CLI creates, checks, tests, and deploys applications. Its `ferrite agent
  connect` command links your coding agent to an existing dashboard account
  after you approve the request in the dashboard, and `ferrite agent recover`
  completes that connection if it was interrupted. For the current version and
  the development workflow, see the [CLI guide](/developers/cli/).
- **Source deployments.** Ferrite checks and builds the application, starts it,
  and reports the host once the new build is serving. Each attempt is
  journaled in the project, and `ferrite deploy status`, `wait`, and `resume`
  recover an interrupted attempt without submitting a second build.
- **Managed resources.** Applications use stores, queues, logs, blob storage,
  HTTPS routes, and outbound HTTP to the destinations they declare.
- **Previews.** `ferrite preview` deploys the committed revision to an isolated
  URL that expires automatically.
- **Prepaid credit.** A temporary account starts with a small platform-funded
  balance that covers this tutorial. A durable account starts without credit,
  so its owner adds credit before the first deployment. Every deployment
  charges a fee that draws on your
  account's credit balance; an instance can also meter running apps and
  requests, and the `estimate_cost` tool tells you which meters it has active.
  The platform refuses paid work when the
  balance is too low. [Understand usage and
  credits](/kb/guide/usage-and-credits/) explains how to check the balance and
  add credit.

- **Platform AI gateway.** The [Responses API gateway](/developers/ai-gateway/)
  accepts account-bound credentials, streams supported provider responses,
  reserves account credit before dispatch, and records the settled cost.
  Bring-your-own-key calls retain usage attribution without a platform
  inference debit.
- **Dashboard account controls.** [Dashboard](/developers/dashboard/) shows
  credit and usage coverage, with recovery controls after
  a credit refusal. Spending ceilings are planned and not yet available.
  Missing telemetry remains unavailable. The
  rollback button remains disabled.
- **Five product examples.** [Apps](/developers/apps/) includes real local
  screenshots of Shop, Yoga, Acme Store, Next Books, and Plan Studio. The
  selected browser qualification passed 153 assertions. Payments used
  fixtures, and Plan Studio's built-in reviewers use deterministic templates.

## Limits in this release

The following limits affect how you build on this release:

- Applications are Rust crates that depend only on `ferrite-app`. Admission
  refuses source that names other crates, direct operating-system access, build
  scripts, or unsafe code.
- Delivery to applications is at least once. Use the request's idempotency key to
  make writes safe to repeat.
- Rollback returns an application to its previous build only, and it does not
  restore stored data. For the procedure, see [Roll back a
  release](/kb/guide/roll-back-a-release/).

If a step in the quickstart fails, [get help from the Ferrite
team](/kb/guide/get-help-from-the-ferrite-team/) with the step and the message
you saw.
