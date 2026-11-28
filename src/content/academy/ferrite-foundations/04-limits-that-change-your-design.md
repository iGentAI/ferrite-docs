---
kind: lesson
course: ferrite-foundations
title: Limits that change your design
description: "The storage, queue, ingress, timeout, expiry, concurrency, and account bounds that shape how you architect a Ferrite application from the first version."
order: 4
---

Hard service bounds are easiest to live with when you design around them from
the first commit. On Ferrite, the limits on atomic writes, batch reads, scans,
payload sizes, timeouts, and account sizing govern key layout, upload flows,
background job queues, and concurrency from day one.

## Storage and queue bounds

Ferrite's storage and queue services enforce these limits on the server side,
so they apply to every client that calls them. APE (atomic envelope) is the
atomic storage binding where the yoga studio keeps its bookings.

| Binding | Operation | Bound | Design consequence |
| --- | --- | --- | --- |
| APE | One atomic write (`commit_n`, `commit_n_if`) | 64 entries | Any write that must be atomic has to fit inside a single envelope. Keep per-action mutations small. |
| Store | `put_batch` | 256 entries | Split larger imports into batches of at most 256 entries that are each safe to repeat. |
| APE and store | `multi_get` | 256 keys | The studio reads every class count in one call; a large timetable needs paging. |
| Store | `scan_prefix` page | 1,024 rows | Scan with an explicit page limit and resume from the last returned key. |
| Queue | `poll_wait` | 30,000 ms | A worker parks for at most 30 seconds before looping. |
| APE | Any key | No scan, delete, or expiry | An APE binding reads only keys you name explicitly. Maintain an index key for anything you list, as the studio's `seats/CLASS_ID` count indexes its `booking/CLASS_ID/SEAT` keys, or keep a queryable copy in a store binding. |

## Request, reply, and outbound call bounds

Per-request ceilings shape application interfaces just as directly as storage
bounds do. An incoming request body is capped at 262,144 bytes (256 KiB), so
larger uploads arrive across multiple requests and are stored in parts in
object storage. A reply on an `api` route carries up to about 4 MiB; larger
results go to object storage to be served from a `content` route, or return in
paginated parts.

Design HTTP handlers to reply within 8 seconds. The gateway's code default is
10 seconds, and the recommended configuration sets 8 seconds. Any operation that
waits on a model call or a slow external service belongs on a background queue,
where the HTTP handler enqueues the job and returns an identifier the caller
can poll. Buffered outbound HTTP calls have their own ceiling: 10 seconds for
the entire exchange and a 1 MiB response body limit.

## Expiry and concurrency

Two runtime behaviors shape correctness directly, independent of payload or
batch size.

### Expiry

A store key written with `put_expiring` disappears from every read once its
expiry timestamp passes. That timestamp is absolute, expressed in milliseconds
since the Unix epoch, so calculate it from `ctx.now_ms()` plus the lifetime you
want. Do not build a background sweeper to delete expired store entries: a
manual sweeper races the platform's native expiry. APE keys do not expire.

### Concurrency and stalled GET retries

A single serial queue loop that pulls a message, handles it, publishes a reply,
and acknowledges it processes one request at a time per instance, regardless of
how many connections the gateway holds open. Alloy's `serve` runs this serial
loop. Because each studio handler performs only a few storage calls, one loop
handles a small timetable comfortably. An application with slower handlers
spawns several competing consumers from `run`, and any shared writes must then
be guarded for concurrency with the guarded-write pattern from lesson 3.

Slow read handlers carry one extra requirement. The gateway replays only a
stalled `GET`, up to three times, and never replays any other HTTP method. Each
replayed copy shares the same `correlation_id`, and the first reply wins.
Alloy's `serve` caches recent `GET` replies in memory so repeats arriving on
the same instance return immediately, yet another instance can still execute
the handler in parallel. Keep `GET` handlers free of writes, or make every
write inside a `GET` handler safe to repeat.

## Account sizing and manifest validation

Your Ferrite account sets compute limits of its own. A trial account lasts 48
hours and starts with $5 of credit, enough to run an app or a few. It runs one instance per application, with
256 MiB of memory and half a CPU. If a deployment manifest asks for more
instances, memory, or CPU on a trial account, the platform reduces those values
to the trial bounds without refusing the deploy. Designs that rely on multiple
instances or more than 256 MiB of memory therefore behave differently on a
trial account than on a durable account, which is not held to those caps. Run
`ferrite cost --json` to inspect the full platform estimate, including the
exact instance count, memory, and CPU bounds that will apply.

The manifest also enforces field bounds of its own, including the minimum
`compute.memory_mb` and the 16-name ceiling on `forward_headers`. You can check
a manifest without compiling anything:

```bash
ferrite validate
```

`ferrite validate` is a local approximation and permits more forwarded headers
than the platform accepts. For the authoritative check, run
`ferrite check --remote`, which calls the platform's `validate_spec`.

Every figure in this lesson and the full set of manifest constraints live in
[Limits](/developers/limits/). To see the exact status codes and headers a
caller receives when the gateway refuses a request, read
[Ingress limits and status codes](/kb/guide/ingress-limits-429-402/).
