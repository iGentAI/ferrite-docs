---
title: Ingress limits and status codes
description: Gateway size, timeout, queue-depth, and balance checks enforced before requests reach your app, with the HTTP status code and client retry rule for each.
topics: ["ingress-and-limits", "billing"]
updated: 2026-11-16
featured: true
---

Every request to a Ferrite app passes through the platform gateway. Before forwarding a request, the gateway enforces size limits, waiting-request caps, and account balance checks. The HTTP status code tells your client what tripped and how to react: honor `Retry-After` on `429`, and stop retrying `402` until the account has credit again.

## Gateway limits

| Limit | Default | Result |
| --- | --- | --- |
| Request line and headers | 16 KiB | `431 Request Header Fields Too Large` |
| Number of request headers | 64 | `400 Bad Request` |
| Request headers forwarded to the app | Only names listed in `forward_headers` (at most 16) on `api` and `grpc` routes | Unlisted headers are stripped before the app sees the request |
| Request body | 256 KiB | `413 Payload Too Large` |
| `Transfer-Encoding: chunked` request body | Not accepted | `400 Bad Request` |
| Method on an `api` route | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | `405 Method Not Allowed` for `OPTIONS`, `HEAD`, and `TRACE` |
| Method on a `content` route | `GET`, `HEAD` | `405 Method Not Allowed` |
| Request body on a `content` route | None accepted | `400 Bad Request` |
| Time for the app to reply | 10 seconds in gateway code; 8 seconds on the recommended configuration | `504 Gateway Timeout` |
| Requests waiting for a reply | 1,024 | `429 Too Many Requests` with `Retry-After` |
| Reply headers | 16 max, first value only per repeated name (one `set-cookie` per reply) | Extra headers are dropped |
| Reply body | About 4 MiB of arbitrary bytes on an `api` route | Reply rejected; client receives `504` at the deadline, reason logged only in app logs |
| WebSocket message | 1 MiB | Connection closed |
| Outbound buffered response body | 1 MiB (streaming handles larger bodies) | Outbound call refused |
| Outbound call timeouts | 2 seconds connect, 2 seconds TLS handshake, 10 seconds buffered response, 25 seconds total deadline, 30 seconds stream idle | Outbound call fails |

See [Limits](/developers/limits/) for the full reference, and [Headers & Cookies](/developers/headers-cookies/) for working within the single `set-cookie` rule.

Target under 8 seconds per handler: the gateway code default is 10 seconds, and the recommended configuration sets 8. Any outbound call your handler awaits counts against that same deadline.

Your app never receives an `OPTIONS` request. The gateway answers `405`, or handles the preflight itself for `GET`, `POST`, and `OPTIONS` when the installation's ingress policy configures a CORS origin. The gateway also strips any `Access-Control-Allow-Origin` header your app sets on a reply. Serve the browser front end from the same app host as the API so requests stay same-origin and avoid cross-origin preflights.

## `429`: too many requests

`rate_limit_per_min` enforcement is not established on Ferrite Cloud, so `ferrite deploy` and `ferrite cost` hold any manifest that declares the key and explain why. Keep the key if you have declared it, and do not bypass the hold through raw `deploy_source`. See [Rate limits](/developers/rate-limits/) for the hold details and how to bound a route with the `http-route-budget` package. That package maintains one shared token bucket per route across all callers and returns `429` with `Retry-After` when empty; if you need per-caller limits, count requests per caller inside your app.

The gateway returns `429` in three situations:

- Waiting requests hit the 1,024-request cap: the gateway refuses new requests with the body `parked-request depth cap; retry` before publishing them, so queues behind the app stay bounded.
- Open streams or WebSocket connections reach the gateway's concurrency cap.
- A per-client static-ingress limit trips where the installation's ingress policy sets one.

Clients should honor `Retry-After`. Persistent `429` replies with `parked-request depth cap` mean your app is falling behind traffic; add instances or move slow work onto a queue.

## `504`: the reply didn't arrive in time

When a handler misses the deadline, the gateway answers `504 Gateway Timeout`. Your app may still finish executing, and its late reply is discarded.

A reply larger than about 4 MiB surfaces as the same `504`, because the platform refuses to publish it; the cause appears only in your app's logs. Move work that routinely approaches or exceeds 8 seconds onto a queue, and return an operation ID the client can poll.

## `402`: the balance can't fund the request

Where credit checks are enabled, the gateway bills requests in batches of 64 so most requests skip a round trip to the account ledger. When your balance cannot fund the next batch, the gateway returns `402 Payment Required` with the body `prepaid balance exhausted; no lease, no service`.

Stop retrying on `402`. Every subsequent request fails until the account has more credit.

When the balance hits zero, your applications stop. They are retained for 30 days and then permanently deleted along with their data. A trial account's apps are suspended when credit runs out; sign in through its claim link to keep the account. See [Understand usage and credits](/kb/guide/usage-and-credits/) for how the `notifications` tool reports each stage and how apps restart after a top-up.

## `502`: the ledger was unreachable

If the gateway cannot reach the account ledger when leasing a new batch, it refuses unbillable requests with `502 Bad Gateway` and the body `credit ledger unavailable`. Neither your app nor your balance caused the error. If it persists for more than a few minutes, report it with the deployed app ID and the UTC time ([Report a bug](/kb/guide/report-a-bug/)).

## Retry without repeating effects

Delivery is at least once. If the instance handling a request fails before finishing, the platform delivers the request again with no deduplication. Your app detects repeats through the `idempotency_key` attached to each request, which the gateway sets from the client's `idempotency-key` header.

Without an `idempotency-key` header, every request looks new, so retrying after a lost reply repeats the effect. Retrying clients must resend the same header on every attempt, and your app must record that key alongside the effect to recognize repeats.

The gateway automatically resends only stalled `GET` requests, up to three times, with the same key as the original; it never repeats any other method. Because a `GET` handler can run more than once for a single client call, keep `GET` handlers free of side effects. See [Apply queue effects once with APE](/kb/guide/exactly-once-effects-with-ape/) for queue deduplication.
