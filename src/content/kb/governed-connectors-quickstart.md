---
title: How connectors keep credentials and approvals in your app
description: Keep third-party credentials, scoped grants, and human approvals inside a gatekeeper compiled into your app so agents call a typed API without touching secrets.
topics: ["governed-connectors", "source-packages"]
updated: 2026-11-16
---

When your app acts on an external service such as GitHub, three pieces stay inside your app in a *gatekeeper* source package: the service's credentials, the scoped grants defining which resources it can reach, and the record of every action. The agent driving the connector calls only a typed API and never sees the raw credential.

The credential stays in your application, either in the backend you implement or in the gatekeeper's token vault; as with any Ferrite app, your running code receives its declared secrets ([Secrets & Egress](/developers/secrets-egress/)). On every call, the gatekeeper checks a scoped grant, queues side-effecting actions for human approval, and logs the outcome.

Two connector packages are published: `connector-github` and `connector-google` (Google Docs, Sheets, and Drive folders, with OAuth tokens stored in the gatekeeper's token vault). Both packages implement the contract and pass offline tests; neither has been tested against live vendor APIs yet, so plan to build your backend and test against the real upstream service.

## Add the connector

Install the GitHub connector package:

```bash
ferrite add connector-github
```

`ferrite add` copies `connector-github` and its `gatekeeper` contract dependency into your app's `src/` tree, records the mount in `ferrite-packages.json`, and prints the module declarations to add. `Cargo.toml` still lists one dependency.

The bundled backend runs in memory for tests only. To reach GitHub, implement the `GithubBackend` trait over an egress binding you declare; that backend holds the token.

## How an action is handled

Side-effecting calls such as `open_pull_request` in `connector-github` or `append_to_document` in `connector-google` enter an approval queue and return a simulated result immediately. The agent can keep working while a person reviews the pending action.

A person approves or rejects queued actions one at a time through the connector: `approve_and_apply` approves and executes an action, `reject_action` rejects it, and `connector-github` uses `approve_comment` for queued comments. The `gatekeeper` contract also defines all-or-nothing batch approval. Because the published connectors keep their queue private, apps built on them approve one action at a time.

Each approval binds to a digest of the reviewed arguments, so it cannot apply if the arguments change. Auto-approval runs only when the user opts in to that action kind and the connector marks that kind auto-approvable. A rejected action never takes effect. Where a connector implements revert for an action, it can undo an applied action for as long as the process that applied it stays running (see [What doesn't survive a restart](#what-doesnt-survive-a-restart)).

Authority comes from capability grants. Each grant carries resource scopes, an expiry time, and the revocation epoch under which it was issued. Raising a principal's revocation epoch invalidates every grant from earlier epochs. Your app maintains the `EpochRegistry` passed into each grant-checked connector call; revoking a principal's grants means bumping its epoch there. The connector caches the highest epoch observed in memory, so a stale registry cannot revive a revoked grant while the process runs.

## What the gatekeeper records

Every connector logs:

- Each read: timestamp, resource (kind, unit, and sub-resource), summary, sharing policy, and allow or block decision.
- Each submitted action: simulated outcome, decision, and any revert.
- SHA-256 credential fingerprints via `token_fingerprints()` (never raw credential values) on connectors that store OAuth tokens in `TokenVault`, such as `connector-google`.

The trail lives in process memory. Allowed reads stay for the surface's lifetime; refused reads keep a total count plus the 32 most recent records. Persist anything you need to retain.

## What doesn't survive a restart

Connectors keep all state in process memory, including the observation trail. A restart, redeploy, or scale-to-zero drops:

- Pending actions in the approval queue and the history of applied actions. Revert works only while the process that applied the action is still alive; undoing an action after a restart requires a journal you write and a recovery path you build.
- OAuth tokens held by `connector-google`. The token vault cannot be serialized and only fingerprints can be persisted, so users reconnect after a restart.
- The highest revocation epoch cached by the connector.

Each instance of your app holds its own separate state, so an action queued on one instance cannot be approved on another. Run a connector app as one instance, and persist any durable record (such as which actions were applied) to your app's store yourself. The connectors expose no call to reload a queue or receipt.

## What your app supplies

The packages supply the contract and state machines. Your app supplies the remaining four pieces:

- A `GithubBackend` or `GoogleBackend` implementation over a declared egress destination.
- The review UI where a person approves or rejects queued actions.
- The `EpochRegistry` used to revoke grants.
- Storage for any record that must survive a process restart.

Until you wire up those pieces, a connector runs only against its test backend. See [Packages](/developers/packages/) for the full package catalog.
