---
title: Why ferrite check rejects your spec
description: Lookup of the source gate and manifest refusal codes reported by ferrite check and Ferrite Cloud, with the rule behind each code and the smallest fix that passes.
topics: ["manifest-gate", "constrained-apps"]
updated: 2026-11-16
featured: true
---

A Ferrite app receives handles only for the services, routes, and outside destinations declared in `ferrite.json`. Two admission checks run before the platform compiles it: the source gate rejects code that reaches the machine, network, or build environment outside those handles, and manifest validation rejects a `ferrite.json` that cannot describe a runnable app. These checks filter code ahead of the build; runtime containment of the running app is the security boundary. See [What bounds your app](/developers/why-it-is-safe/).

You can run the checks in two places, and their results can differ:

- `ferrite check` runs the local source gate, manifest checks, and `cargo check`.
- `ferrite check --remote` calls the platform gate, which decides deployment admission. `ferrite deploy` runs the platform gate before submitting.

Several checks are stricter on the remote platform gate than in local `ferrite check`. Both gates enforce the reviewed macro list (`macro_rules!` and unreviewed macro names are refused locally and remotely), while bare invocations of reviewed names without a same-module `use` (such as `info!` or `json!`) pass locally and fail remotely as `CODE_MACRO_OPAQUE`. The remote gate also enforces `CODE_AMBIENT_AUTHORITY_ALIAS` and `CODE_MANIFEST`, which local checks do not emit. Build-time file reads differ too: both gates admit `include_str!` on a UTF-8 file anywhere inside the app directory because the CLI submits every file an `include_str!` names, and both admit `include_bytes!` on a UTF-8 file under `src/` or `tests/`, whereas the platform gate refuses `include_bytes!` on a binary file or on a file outside `src/` and `tests/` (which the CLI does not upload) while the local gate admits it. The CLI also stops before submitting if `include_str!` targets a file outside the app directory or `ferrite.local.toml`.

Run `ferrite check --remote` before relying on a local pass. If Rust is not installed locally, run `ferrite check --no-cargo` to run the gate and manifest checks without `cargo check`.

For codes in the local catalog, `ferrite explain CODE` prints the cause and fix. For platform-only codes, `ferrite explain` reports that the code is absent from the local catalog; look it up below or ask your agent to call `explain_gate` with the code (works without signing in).

## Source gate codes

### `CODE_DEP_UNLISTED`

A `[dependencies]` entry other than `ferrite-app`. Everything an app needs is re-exported from `ferrite-app`, and shared packages are added with `ferrite add`. Move test-only crates to `[dev-dependencies]`, where the platform test gate admits only `ferrite-app-test` and `tokio`. See [The one-dependency rule, explained](/kb/guide/one-dependency-rule-explained/).

### `CODE_AMBIENT_AUTHORITY`

Source that names `std::net`, `std::fs`, `std::process`, `std::env`, `std::os`, `std::thread`, `std::arch`, `core::arch`, system clock types (`std::time::SystemTime`, `std::time::Instant`), `libc`, or `tokio::net`, `tokio::fs`, or `tokio::process`. Use `AppContext` handles for I/O and `ctx.now_ms()` for timestamps. `std::time::Duration` remains allowed.

The platform also reports `CODE_AMBIENT_AUTHORITY_ALIAS` for importing a module that contains restricted paths, such as `use std::time as t;` or `use std::*;`, or for declaring a local module or import that shadows a compiler or SDK namespace. Local `ferrite check` does not emit this code, so it first surfaces on `ferrite check --remote` or `ferrite deploy`. Import the exact item you need, such as `use std::time::Duration;`, instead of its parent module.

### `CODE_UNSAFE_PERMITTED`

A crate root missing `#![forbid(unsafe_code)]`, or `unsafe` code anywhere in the source. Put `#![forbid(unsafe_code)]` on the first line of `src/main.rs` and `src/lib.rs`, and remove all `unsafe` code.

### `CODE_BUILD_SCRIPT` and `CODE_PROC_MACRO`

A `build.rs` file, a `build` key under `[package]` set to anything other than `false`, a `[build-dependencies]` table, or `proc-macro = true`. Apps cannot execute code at build time; remove these entries.

### `CODE_MANIFEST` and `CODE_SOURCE_UNPARSEABLE`

The platform gate reports `CODE_MANIFEST` for a forbidden Cargo control: a `[patch]` or `[replace]` table, `cargo-features`, a `[workspace]` table containing anything other than `package` or `metadata`, or profile keys outside standard settings such as `opt-level`, `lto`, and `codegen-units`. Remove the control. A dependency sourced from git or a registry is rejected as `CODE_DEP_UNLISTED`.

`CODE_SOURCE_UNPARSEABLE` means a source file is not valid UTF-8 or contains syntax the gate parser cannot read; the message names the file.

### `CODE_BUILD_TIME_READ`

A macro that reads data at build time (`include!`, `env!`, `option_env!`), or an `include_str!` or `include_bytes!` whose target the platform did not receive: a file outside the app, a binary file, or an `include_bytes!` outside `src/` and `tests/`. Read runtime configuration from `ctx.secret`. For static assets served by your app, see [Serve static assets from Blob](/kb/guide/serving-static-assets-from-blob/).

### `CODE_MACRO_OPAQUE`

A `macro_rules!` definition, an unreviewed macro name, or a bare invocation of a reviewed macro name without a same-module `use`. Local `ferrite check` already catches `macro_rules!` and unreviewed macro names, while bare invocations (such as `info!` or `json!` with no matching `use` in the same module) pass locally and fail on `ferrite check --remote` or `ferrite deploy`. Add `use ferrite_app::tracing;` and call `tracing::info!`, or write the full path `ferrite_app::tracing::info!`.

## Manifest codes

Most manifest codes start with `APP_`, `COMPUTE_`, or `SPEC_`. The entries below cover the services, routes, compute bounds, and outbound calls of a typical app.

### `SPEC_UNPARSEABLE` and `SPEC_PARSE`

`ferrite.json` is invalid JSON or does not match the manifest schema. The local check reports `SPEC_UNPARSEABLE`; the platform reports `SPEC_PARSE`. The platform parser also rejects unknown keys, one per check, including legacy keys `auth`, `required_secrets`, and `stream_mode`.

One key is caught before it reaches the parser. Because enforcement of `rate_limit_per_min` is not established on Ferrite Cloud, `ferrite deploy` and `ferrite cost` block any manifest carrying it and explain why. `ferrite deploy` refuses before submitting with `DEPLOY_MANIFEST_KEYS_REFUSED` and names where the key sits; a manifest sent straight to the platform parser with that key would be rejected as `SPEC_PARSE`. Keep the key if you declared it, and do not bypass the hold through raw `deploy_source`. See [Rate limits](/developers/rate-limits/) for the hold details and how to bound a route with the `http-route-budget` package.

### `APP_BINDING_UNDECLARED` and `APP_BINDING_KIND_MISMATCH`

A binding names a service not declared in the manifest, or the binding's `kind` does not match the service's `primitive`. Valid binding kinds are `queue`, `store`, `ape`, `log`, `topics`, and `blob`.

### `APP_ROUTE_BINDING_UNDECLARED` and `APP_ROUTE_KIND_MISMATCH`

A route names a binding the app does not declare, or pairs incompatible kinds. A `content` route requires a `blob` binding; `api`, `grpc`, `ws`, and `stream` routes require a `queue` binding.

### Outbound destination codes

`APP_EGRESS_UNSCOPED`, `APP_EGRESS_DESTINATION_MALFORMED`, and `APP_EGRESS_INTERNAL_DESTINATION` mean, respectively, that an outbound handle declares no destination, that a destination is not an absolute `https://` URL prefix (`http://` is tolerated only on local checks, never on Ferrite Cloud), or that a destination targets loopback or private address space. Declare explicit public `https://` URL prefixes.

### `APP_ARTIFACT_HASH_MALFORMED`

`artifact_sha256` is not 64 hexadecimal characters. For a source deployment, use 64 zeros; the platform fills in the hash of what it builds.

### `COMPUTE_MEMORY_TOO_SMALL` and `COMPUTE_CPU_INVALID`

`compute.memory_mb` is below 16, or `compute.cpu_percent` is zero. Raise the value, or remove `compute` so the platform default bound applies. Trial account limits apply regardless of what the manifest requests; `estimate_cost` shows the bound that will take effect.

## What a pass doesn't tell you

Passing means your source invokes none of the powers the source gate blocks and your manifest describes a runnable app. The gates do not verify application logic, authorization rules (such as which signed-in user may read which record), or expected runtime behavior. Cover those with tests run through `ferrite test`.

## Fix one rejection at a time

Fix the first violation, then re-run both the local and remote checks:

```bash
ferrite check
ferrite check --remote
```

One edit often clears several violations that share a cause, and the next run shows what remains. If the platform returns a code that neither this page nor `explain_gate` covers, send the code and full output to the Ferrite team; see [Report a bug](/kb/guide/report-a-bug/).
