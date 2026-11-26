---
title: "Schedule work with delayed publish"
description: "Ferrite has no cron syntax in ferrite.json. Schedule one-time and recurring jobs with queue publish_at messages, guarded state transitions, and idempotent workers."
topics: ["cron", "queue"]
updated: 2026-11-16
---

Ferrite has no cron setting in `ferrite.json`. To schedule future work, publish a message to an ordinary queue with `publish_at(payload, not_before_ms)`, which holds the message invisible until that epoch-millisecond timestamp. The queue persists the message before `publish_at` returns, so app restarts and redeploys preserve every due job and no process has to stay alive holding an in-memory timer. Publish delayed jobs to a standard `queue` binding; frames (stream) queues reject `publish_at`.

## Schedule one future action

Write the domain record first, then publish a delayed job that names it:

```rust
let job = ReminderJob { booking_id, scheduled_for_ms };
reminders
    .publish_at(&serde_json::to_vec(&job)?, scheduled_for_ms)
    .await?;
```

`publish_at` takes no separate key parameter, so put the job's identity in its payload (`booking_id` and `scheduled_for_ms` above). The platform queue also has no cancel API. When a worker leases the message after its due time, re-read the domain record and apply the reminder only if the booking still needs it. A late or repeated message for a canceled booking does nothing.

## Schedule recurring work

Store the schedule's next due timestamp in durable state and chain occurrences: each worker run publishes the delayed job for the next occurrence. Updating stored state and publishing to the queue are two separate writes, so a crash between them creates one of two failure modes:

- If the worker advances stored state first and crashes before `publish_at` succeeds, no job exists for the next run and the schedule stops.
- If the worker publishes first and crashes before advancing stored state, redelivery publishes a second job for the next occurrence.

Design for both crash windows by putting each occurrence's due time in its payload and guarding state updates with APE (atomic envelope), the service behind [Transactions](/developers/transactions/):

1. When a job arrives, commit its effect and the advanced next due time in one `commit_n_if` call guarded on the stored due time still matching the job's due time.
2. Read the stored next due time (whether this attempt advanced it or an earlier crashed attempt did) and call `publish_at` for that timestamp.
3. Call `ack` on the current message only after `publish_at` returns `Ok`.

If a worker crashes between step 1 and step 3, redelivery hits a guard mismatch, skips reapplying the effect, still publishes the delayed job for the stored next due time, and acknowledges the lease. If two jobs end up queued for the same occurrence, the first advances the guard and the second writes nothing. For multi-step or long-running orchestration, see [Workflows](/developers/workflows/).

## Troubleshoot a scheduled job

| Symptom | Cause and fix |
| --- | --- |
| The job ran twice | Queue delivery is at least once. Record each job's identity alongside its effect in one atomic write and skip completed jobs; see [Apply queue effects once with APE](/kb/guide/exactly-once-effects-with-ape/). |
| The job ran late | `publish_at` sets a floor on delivery time, and execution happens when a worker leases the message. A busy or stopped worker delays it. When an account's prepaid balance hits zero, its apps stop and due jobs wait in the queue until the apps resume (after 30 days at zero balance, stopped apps and their queued data are deleted); see [Understand usage and credits](/kb/guide/usage-and-credits/). |
| The job did nothing | The worker re-checked domain state and found the action was no longer required, which is the intended outcome for a stale or canceled job. |
| The job stopped running | Repeated failures exhaust the queue's persisted attempt budget (restarts do not reset it) and move the message to the dead-letter queue. Inspect dead-letter metadata with the MCP `dead_letters` tool and clear them with `remove_dead_letters` (the MCP tools do not return payloads or redrive messages; full payload reads via `read_dead_letter` and republishing via `redrive_dead_letters` exist only as Rust queue handle methods in platform builds, not in the local SDK). |
| A recurring schedule stopped | No delayed message exists for the stored next due time. Publish one job for that stored timestamp to restart the chain, then audit your worker for any path that calls `ack` before `publish_at` returns. |

For limits and queue methods, read [Cron Jobs](/developers/cron-jobs/) and [Queues](/developers/queues/).
