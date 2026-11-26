---
title: "Ferrite CLI 0.1.13"
date: 2026-10-04
docLink: /developers/cli/
authors: ["Ferrite Team"]
---

Ferrite CLI 0.1.13 brings the local SDK twin in line with three fields the
native Ferrite SDK defines, and it scaffolds and syncs RSX applications with
RSX 0.2.2, which compiles against that twin. It is built for macOS on Apple
silicon and x86-64 Linux. Because the twin changed, `ferrite --version` reports
a new twin identity, `sha256:a65578ab…`, in place of 0.1.12's `sha256:e8fafebc…`.

## What changed

- **`AppContext::instance()`.** The injection payload gains an optional
  `instance` field, the endpoint identity the hosted worker injects, and
  `ctx.instance()` returns it. It is absent under the local Forge runtime and
  is never read from secrets.
- **Member zones.** `WireMember` gains an optional `zone`, the zone the worker
  certifies for a member seat. Older and local payloads leave it out and decode
  with no zone.
- **`IngressRequest::stream_open`.** The request envelope gains `stream_open`,
  which is true when the gateway opens a stream session and false for an
  ordinary request. It defaults to false when absent, and
  `IngressRequest::new` sets it to false, so tests that build requests keep
  compiling. Under `ferrite dev`, the local gateway sets it on SSE opens and
  leaves it false for ordinary requests and WebSocket frames.
- **RSX 0.2.2.** `ferrite rsx new` and `ferrite rsx sync` write the RSX 0.2.2
  runtime, whose server module constructs members with the new `zone` field, so
  a generated RSX application compiles against the 0.1.13 twin.

See [Ferrite CLI](/developers/cli/) for installing and checking the release.
