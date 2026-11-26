---
kind: lesson
course: ferrite-foundations
title: "Optional: services reference"
description: "Every service binding available on AppContext, its async client contract, binding-free context methods, and re-exported SDK crates."
order: 8
---

Ferrite exposes a compact, fixed set of runtime primitives so every piece of application I/O runs through typed async clients without external database drivers or connection-pool boilerplate. The yoga studio uses queues, stores, and atomic storage; whenever an application needs streams, binary objects, or outbound HTTPS, you declare the binding in `ferrite.json` and retrieve its client from `AppContext`.

## Service bindings on AppContext

Each accessor resolves a binding by the handle name declared in `ferrite.json` and verifies its kind when called, so a manifest mismatch surfaces on the first call. To catch wiring errors at startup, call each accessor once inside `run`. Every client method is `async` and returns `std::io::Result`, and all keys and values are bytes.

| Accessor | Service | Use it for |
| --- | --- | --- |
| `ctx.store("NAME")?` | Store | Key-value state: `get`, `put`, `put_if_version`, `put_expiring`, `add`, `multi_get`, and `scan_prefix` |
| `ctx.ape("NAME")?` | Atomic storage (APE) | Several keys written together: `commit_n` and the guarded `commit_n_if` |
| `ctx.queue("NAME")?` | Queue | Work distribution, delayed jobs, and request ingress: `publish`, `publish_at`, `poll_wait`, and `ack` |
| `ctx.log("NAME")?` | Log | Ordered, replayable streams: `append` and `read_from` |
| `ctx.topics("NAME")?` | Topics | Many named streams behind one binding |
| `ctx.blob("NAME")?` | Blob | Large binary objects, checked against their digest on read |
| `ctx.egress("NAME")?` | Egress | Outbound HTTPS to the destinations the manifest declares |

Those seven accessors cover the entire surface: six service binding kinds, plus egress declared in its own `egress` array in `ferrite.json`. Application state follows a key-value model: organize records under key prefixes in a store, and enforce invariants that span multiple records with atomic storage. For exact-term indexes over Store and external relevance-ranked search over egress, see [Search](/developers/search/).

In any project whose manifest binds a store named `state`, reading and writing a key looks like this:

```rust
let mut state = ctx.store("state")?;
state.put(b"greeting", b"hello from the store").await?;
let value = state.get(b"greeting").await?;
assert_eq!(value.as_deref(), Some(&b"hello from the store"[..]));
```

To test a change against a copy of live application data, fork the application with `ferrite fork` or the MCP `fork` tool. The fork runs as an independent application on the platform with its own copy of the data.

## Built-in context methods and re-exports

Three capabilities live directly on `AppContext` with no manifest binding required:

1. `ctx.now_ms()` returns the current time in milliseconds since the Unix epoch in place of the standard library clocks blocked by the gate rules in lesson 6.
2. `ctx.secret("NAME")` returns a secret value as `Option<String>`, and `ctx.secret_names()` lists available secret names, as covered in lesson 7.
3. `ctx.notify(severity, kind, body)` posts a notification about the application to its owner's notification feed. `severity` accepts `info`, `warn`, or `error`; `kind` is a caller-defined label up to 64 characters drawn from `[A-Za-z0-9_.-]`; and `body` holds at most `ferrite_app::MAX_NOTIFY_BODY` bytes. Any body over that limit fails with `InvalidInput` before anything is sent. If a deployment carries no notification service, the call returns `NotFound`, so treat notifications as best effort.

Serialization and structured logging ship re-exported from `ferrite-app`. Import `ferrite_app::serde_json`, `ferrite_app::serde`, and `ferrite_app::tracing` directly without declaring separate dependencies in `Cargo.toml`.

For each service's full contract and method reference, read the pages under **Data** in the developer documentation, starting with [Key-value Store](/developers/store/).
