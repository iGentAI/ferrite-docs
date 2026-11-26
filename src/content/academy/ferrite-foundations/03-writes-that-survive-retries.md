---
kind: lesson
course: ferrite-foundations
title: Writes that survive retries
description: "Why requests arrive more than once on a queue-backed platform, and how the studio commits a seat count, booking record, and request marker in one guarded atomic write."
order: 3
---

Once an application sits behind a queue and a network timeout, duplicate
delivery is normal operating behavior. A booking request can reach the yoga
studio twice for two separate reasons. An app instance can stop after finishing
the work and before acknowledging the message, which causes the queue to
deliver the same message again. Or the caller can send the request again, for
example after the gateway returns `504` at the ingress deadline while the
handler is still finishing. The gateway itself replays only a stalled `GET`, up
to three times, and never replays any other HTTP method. Bookings arrive over
`POST`, so the gateway never duplicates them; lesson 4 covers how stalled `GET`
replays affect read handlers.

Naive handlers break under either condition. A handler that applies its write
on every delivery books the same person twice. A handler that checks "have I
seen this request?" in one call and writes in a second leaves a race window
where two concurrent deliveries both read "no" and both write.

## Guarded multi-key commits with APE

The studio closes that race window by reading the request marker and the seat
count together, then committing all related keys under a single guard. Its
`book` function uses the APE (atomic envelope) binding named `bookings` and
commits three keys in one atomic operation:

| Key | Purpose |
| --- | --- |
| `seats/CLASS_ID` | Number of spaces currently taken in the class |
| `booking/CLASS_ID/SEAT` | Name of the person holding that seat |
| `request/CLASS_ID/KEY/NAME` | Marker recording that this request was admitted |

The write runs through `commit_n_if`, which commits all three keys only if
`seats/CLASS_ID` still holds the exact bytes this attempt read earlier. If
another write changed that counter in between, none of the three entries are
applied.

That single guarded commit enforces two invariants at once. First, a repeated
request never books twice. The `book` function reads the request marker and the
class count in one `multi_get`, then commits the marker alongside the updated
count. Any second delivery with the same key discovers the marker, either on
its initial read or after its guarded commit fails and it re-reads, and returns
the original booking result.

Second, a class never exceeds its capacity. When two different people race for
the final space, both handlers read the same seat count. One `commit_n_if`
succeeds and advances the counter. The other fails the guard, reads the updated
state, sees that the class is full, and refuses the booking.

## Where the idempotency key comes from

A request marker catches repeats only when they carry the same key. On
`POST /api/bookings`, the studio uses `request_id` from the request body when
present and falls back to the request's `idempotency-key` header otherwise; the
booking form generates a key of its own in a hidden field. Without either an
`idempotency-key` header or a `request_id`, the key falls back to the
envelope's `correlation_id`. Because the gateway assigns a fresh
`correlation_id` to every HTTP request, a retry with no explicit key counts as
a brand-new request and repeats the booking if the original reply was lost.

Queue redelivery and client retries behave differently here. A redelivery from
the queue is the exact same message with the same `correlation_id` and key, so
the marker catches it automatically. A client retry deduplicates only if the
caller sends the original key again. After a `504`, the gateway has timed out
waiting while the handler may still have committed the booking. Repeating a timed-out
booking unchanged with the original key returns the committed result without
claiming a second seat.

## Envelope boundaries and external effects

One atomic APE write holds at most 64 entries inside a single APE binding.
Writes to a store binding, to object storage, or to an external system such as
an email provider cannot share that envelope.

To coordinate an external effect reliably, record the intent inside the same
guarded APE write, then execute the external call afterward with a stable
deduplication key the receiving service understands. Treat the external send
itself as at-least-once delivery. Alloy's actions implement this outbox pattern
directly: an action queues an outbox intent committed in the same envelope as
the action's marker, and the outbox drain in `serve` executes the effect
afterward with at-least-once delivery, so the receiving service still needs that
stable key. See [Actions & Effects](/developers/alloy-actions/) for how the
outbox works.

The notes action in the base Alloy template uses a lighter tool for a simpler
invariant. `ActionRunner` records a marker and advances a cache tag in one
envelope, which fits any action whose only rule is "apply at most once." The
studio also has to enforce a seat count, so it guards directly on the seat
counter key.

## Break each guarantee locally

You can watch both invariants fail against the studio's test suite. Make each
edit one at a time and run `ferrite test` after each change:

1. Remove the marker entry from the `commit_n_if` call. The repeat-request
   tests fail because the repeated delivery now claims a second space. If those
   tests still pass, verify that you removed the marker entry from
   `commit_n_if` and did not remove the marker key from `multi_get` instead.
2. Change the guard in `commit_n_if` from the seat count key to the marker key
   with `None` as the expected value. The test that commits a booking from a
   stale count fails every time because a write decided from an old count now
   lands. The load test that sends twelve bookings at once usually fails too,
   though the exact outcome depends on how the requests interleave.

Undo both changes and confirm `ferrite test` passes again before moving on to
lesson 4.
