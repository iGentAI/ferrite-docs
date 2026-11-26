---
title: "Apply queue effects once with APE"
description: "Queue delivery is at least once. Pair each effect with a marker in one atomic APE commit using EffectivelyOnceConsumer or commit_n_if, and key external calls separately."
topics: ["ape", "queue"]
updated: 2026-11-16
---

Ferrite queues deliver messages at least once: a worker that crashes before calling `ack` receives the message again, and a retrying client publishes a second message. To apply a message's effect to Ferrite state once, commit the effect and a deduplication marker together in one atomic APE (atomic envelope) write. APE commits 1 to 64 key-value entries as a single record, so the effect and its marker either both land or neither does.

## Use `EffectivelyOnceConsumer`

The SDK packages the lease, marker check, atomic APE commit, and `ack` sequence in `EffectivelyOnceConsumer`. Call `process_one_keyed` with two plain functions: one that extracts the deduplication key from `&WireLease`, and one that returns the `(key, value)` entry to write:

```rust
use ferrite_app::client::{EffectivelyOnceConsumer, KeyedOutcome};

let queue = ctx.queue("orders")?;
let ape = ctx.ape("state")?;
let mut consumer =
    EffectivelyOnceConsumer::new(queue, ape, "orders").with_wait(1_000);
loop {
    match consumer.process_one_keyed(order_key, order_effect).await? {
        KeyedOutcome::Applied { .. } | KeyedOutcome::Duplicate { .. } => {}
        KeyedOutcome::Malformed | KeyedOutcome::Empty => {}
    }
}
```

In this snippet, `orders` and `state` match your app's queue and APE bindings in `ferrite.json`. `order_key` takes `&WireLease` and returns `Option<Vec<u8>>` (`None` marks the message malformed). `order_effect` takes `&WireLease` and returns `(Vec<u8>, Vec<u8>)`. Define both as plain functions so the loop can pass them on every iteration.

For each message, `EffectivelyOnceConsumer` reads the marker key as a fast path. If the marker is absent, it commits the effect and marker together with `commit_n_if(&marker, None, ...)` so overlapping deliveries for the same key cannot double-commit; if another delivery won the race, it absorbs `Err(_current)`, calls `ack`, and returns `Duplicate`. If the marker already exists, it calls `ack` and returns `Duplicate`. If `order_key` returns `None`, it calls `ack` and returns `Malformed`. Adding `.with_wait(1_000)` waits up to 1,000 milliseconds for a message before returning `Empty`; without it, an empty queue returns `Empty` immediately.

Keep `order_effect` pure. It runs before the APE commit and runs again on any redelivery whose prior commit failed to land, so outbound calls made inside it can fire more than once. Handle external side effects as described in [Limits of the recipe](#limits-of-the-recipe).

Because `EffectivelyOnceConsumer` guards each commit on the marker's absence with `commit_n_if`, overlapping deliveries for the same deduplication key do not double-commit. Reach for manual `commit_n_if` or `PartitionAssigner` when a handler performs read-modify-write updates over shared cross-key state (where guarding on the marker alone does not serialize updates to a shared key) or when you need custom handling for malformed messages instead of acknowledging and dropping them.

When one message updates several keys, use `process_one_keyed_n`. Its effect function is async, can read current state, and returns up to 63 entries committed alongside the marker in one atomic envelope. If the effect function or commit fails, `process_one_keyed_n` returns the error without calling `ack`, so the lease expires and the message is redelivered. If the effect function returns zero entries, the consumer writes only the marker and leaves all other keys untouched.

The SDK also offers `process_one` and `drain`, which use the queue message ID as the marker. That mode absorbs broker redeliveries of one message, while letting client retries through as new messages.

## Choose the key

Your key defines what counts as the same logical operation, so derive it from the request or domain record:

- For requests arriving through the gateway, use the envelope's `idempotency_key`. The gateway populates it from the client's `Idempotency-Key` header (retrying clients must resend the same header; without it, each request gets a unique key).
- For an order, booking, or other domain record, use its ID from the message payload.
- Never use the queue message ID for end-to-end deduplication. A client retry arrives as a new message with a new ID.

## Write the sequence by hand

When you need custom handling for malformed messages, or want to pair the marker guard with your own read-modify-write or lease logic, run the loop directly with `commit_n_if`:

1. Read the marker key. If it already exists, call `ack` and stop.
2. Build the effect entries (up to 63) plus the marker entry.
3. Call `commit_n_if` guarded on the marker key being `None` (absent).
4. Treat `Ok(Err(_current))` as a duplicate and call `ack`. A guard mismatch happens either when another delivery won the race or when the APE client retried a commit whose first attempt had already applied.
5. Call `ack` only after `commit_n_if` returns `Ok(Ok(()))` or `Ok(Err(_))`.

Keep that exact order. Calling `ack` before committing loses the effect on a crash in between, and committing the effect without the marker repeats it on redelivery.

## Limits of the recipe

This pattern covers state inside Ferrite. Nothing on the Ferrite side prevents an external API call from executing twice: if a worker charges a card or sends an email, pass your deduplication key to that downstream service as its idempotency key. Recording the result in APE after calling the external service breaks if the worker crashes between the outbound call and the commit. When a third-party service accepts no idempotency key, include a unique client reference that the service stores, and query that reference to reconcile before retrying after any timeout or ambiguous failure.

APE has no delete and no TTL, so each distinct key leaves a permanent marker in storage. Account for unbounded marker growth on high-volume queues where every message carries a new key.

Use the Key-value Store instead of APE for single-key records that need linearizable reads, compare-and-set, deletion, or expiry. See [Transactions](/developers/transactions/) for full APE reference details.
