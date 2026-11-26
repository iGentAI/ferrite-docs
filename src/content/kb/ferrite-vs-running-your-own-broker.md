---
title: "Ferrite queues and logs versus running your own broker"
description: "Bind Ferrite's Queue and Log services for background jobs and ordered event history instead of running a broker cluster. Keep an external broker when non-Ferrite systems or broker-specific tooling depend on it."
topics: ["comparisons", "queue", "planes"]
updated: 2026-11-16
---

For background jobs and ordered event history inside a Ferrite app, bind Ferrite's built-in Queue and Log services in `ferrite.json` instead of running a message broker cluster. You skip cluster sizing, upgrades, rebalancing, and on-call support. Unlike a standalone managed broker, both services are declared alongside your routes in `ferrite.json`, reached through injected handles, and billed from the same prepaid balance. Keep an external broker when systems outside Ferrite consume the same topics directly or when your pipeline depends on broker-specific connectors and stream processors.

## The Queue and Log services

`Queue` hands out work to competing consumers. One worker holds a time-bounded lease on a message at a time, and an expired lease returns the message to the queue. The queue persists each delivery attempt, so attempt budgets survive worker crashes and failing messages move to a dead-letter queue once their budget runs out. `publish_at` delays delivery until an epoch-millisecond timestamp.

`Log` (documented under [Streams](/developers/streams/)) stores an append-only ordered history. Each append receives the next dense offset and is persisted before that offset becomes visible. Retention trims the oldest records without renumbering remaining offsets. Binding `"kind": "topics"` over a `log` service gives you multiple named streams on one service.

One manifest entry gives your code a typed handle for either service:

```rust
let mut work = ctx.queue("jobs")?;
let mut history = ctx.log("events")?;
```

## Compare the options

| Area | Ferrite Queue and Log | Broker you operate |
| --- | --- | --- |
| Operations | Platform manages replication, failover, and upgrades | Your team handles sizing, upgrades, rebalancing, and on-call |
| Durability | Messages and log records survive app restarts and redeploys | Depends on your replication setup, disks, and backups |
| Delivery guarantees | At-least-once with persisted attempt budgets and built-in dead-letter queues | At-least-once; retry budgets and dead-letter routing often require app or plugin work |
| Ordering | Dense offsets in Log; leases or per-key ordered delivery in Queue | Partition-level ordering with consumer-group bookkeeping |
| Once-only state effects | App-level deduplication with APE (`EffectivelyOnceConsumer` or `commit_n_if`) | App-level deduplication or broker-specific transaction features |
| Cost | Metered from your prepaid balance: running instances, reserved service capacity, requests, deploys, and an hourly rate per bound queue or log service (`stream_groups` in `estimate_cost`, included in `ferrite cost`) | Fixed machine spend whether traffic flows or not, plus operator time |

## When to keep a broker

An external broker remains the right fit when any of these conditions apply:

- Systems outside Ferrite already publish to or consume from the same topics directly.
- Your pipeline depends on third-party connectors, schema registries, or stream-processing engines built for that broker protocol.
- Compliance or data-export rules require raw event streams to stay on infrastructure outside Ferrite.

For background work and event history owned by a Ferrite app, Queue and Log cover the job without another cluster to run. Read [Queues](/developers/queues/) and [Streams](/developers/streams/) for manifest schemas and Rust APIs.
