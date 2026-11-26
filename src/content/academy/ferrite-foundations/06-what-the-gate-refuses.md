---
kind: lesson
course: ferrite-foundations
title: What the gate refuses
description: "The source rules every Ferrite application obeys, the error codes the admission gate reports, and where local checks differ from platform checks."
order: 6
---

Most application platforms accept arbitrary binaries or sprawling dependency trees and hope runtime sandboxing catches mistakes later. Ferrite checks authority before a single line compiles. Before the platform builder starts, an admission gate parses your crate and enforces the properties introduced in lesson 1: a single dependency, no `unsafe` code, and no ambient access to the network, filesystem, processes, environment variables, or system clocks. `ferrite deploy` starts no build until the platform gate admits the source, and `ferrite check` runs a fast local approximation during development.

The source gate and runtime containment play distinct roles. The gate filters source before compilation whenever code names a capability the application was never granted, and the runtime containment covered in lesson 7 bounds the running process even if a static check were ever bypassed. The gate verifies capability boundaries alone; checking business rules and authorization logic remains part of your tests and code review.

## The three source rules

Before compiling anything, the gate checks `Cargo.toml` and every `.rs` file under `src/` (plus `tests/` during platform test runs):

1. Depend only on `ferrite-app`. Runtime builds ignore `[dev-dependencies]` because test dependencies never ship. A platform test run (`test_ref`) applies tighter rules: it scans `tests/` alongside `src/` and admits only `ferrite-app-test` and `tokio` under `[dev-dependencies]`.
2. Place `#![forbid(unsafe_code)]` at the top of every crate root and keep all source free of `unsafe`.
3. Name no ambient authority. Application code cannot reference `std::net`, `std::fs`, `std::process`, `std::env`, `std::os`, `std::thread`, `std::arch`, `core::arch`, `libc`, the corresponding `tokio` modules, or the system clocks `std::time::SystemTime` and `std::time::Instant`. Call `ctx.now_ms()` when you need wall-clock time. Any `use` statement that renames or glob-imports a module containing a denied path, such as `use std::time as t;`, is also refused.

Closing the dependency graph around a single SDK crate is what makes static authority checks tractable and builds deterministic. Because an application cannot pull in arbitrary crates from crates.io, helper code either targets `ferrite-app` directly or lives inside `src/` where the gate audits every path, macros included. A backend written directly for Ferrite fits this model from the first line; migrating a Rust service built on a broad external dependency tree means reworking or inlining those dependencies against `ferrite-app`.

## Gate refusal codes

When the admission gate rejects a crate, it returns a stable error code for the rule that failed:

| Code | Cause | Fix |
| --- | --- | --- |
| `CODE_DEP_UNLISTED` | A dependency other than `ferrite-app` | Remove it. A crate used only by tests can move to `[dev-dependencies]`, though a platform test run admits only `ferrite-app-test` and `tokio` there. |
| `CODE_UNSAFE_PERMITTED` | A crate root without `#![forbid(unsafe_code)]`, or `unsafe` code | Add the attribute and remove the unsafe code. |
| `CODE_AMBIENT_AUTHORITY` | Source that names a denied path or clock | Use the injected clients and `ctx.now_ms()`. |
| `CODE_AMBIENT_AUTHORITY_ALIAS` | A `use` that renames or glob-imports a module containing a denied path; the platform reports this code, while the local check reports `CODE_AMBIENT_AUTHORITY` | Name the paths you need in full. |
| `CODE_BUILD_SCRIPT` | A `build.rs` or `[build-dependencies]` | Remove it; a Ferrite app has no build step. |
| `CODE_PROC_MACRO` | A procedural macro crate | Remove it. |
| `CODE_BUILD_TIME_READ` | `include!`, `env!`, `option_env!`, `#[path = "..."]`, or an `include_str!` or `include_bytes!` whose target the gate cannot admit | Keep the data in source or read it from a service. |
| `CODE_MACRO_OPAQUE` | A `macro_rules!` you define, a macro outside the reviewed set (such as `thread_local!`), or a bare `json!` or `info!` with no `use` in the same module (the bare-name check runs on the platform only) | Write the code without the macro, or import the SDK macro with a `use` in the module that calls it. |

To print the canonical explanation and remediation for any code, run:

```bash
ferrite explain CODE_AMBIENT_AUTHORITY
```

An agent working through MCP without the CLI can run the platform gate directly with the `code_gate` tool and look up any error code with `explain_gate`. Neither tool starts a build or incurs a charge.

## Where local and platform checks differ

The local gate parses the crate's syntax tree and inspects every path it names, including paths inside macro invocations, without trusting module layout assumptions. It rejects `#[path = "..."] mod x;` because that attribute pulls in a file outside the source tree the scanner walks.

`ferrite check` and the platform gate can still disagree in both directions, and `ferrite check` notes that boundary in its output. The main gap is macro resolution: the local gate refuses any `macro_rules!` and any macro whose name is outside the reviewed set (`thread_local!` included), yet it checks names only and does not follow `use` items. The platform resolves each macro through the `use` items in its own module and admits only standard compiler macros (`format!`, `vec!`, `assert!`, `matches!`, `write!`, and similar built-ins) alongside the SDK macros `ferrite_app::serde_json::json!`, `tracing::{info,warn,error,debug,trace}!`, and `rt::select!`, written either with their full path or imported by a `use` in the same module. A bare `json!` or `info!` without that local `use`, or a macro from another crate that shares a reviewed name, passes locally and fails on the platform with `CODE_MACRO_OPAQUE`. Whenever `ferrite explain` has no local catalogue entry for a platform-only code, inspect the diagnostic from `ferrite check --remote` or query `explain_gate` over MCP.

Differences around compile-time file reads come from one rule: the platform judges only the files the CLI actually submits.

| Source | `ferrite check` | Platform |
| --- | --- | --- |
| A `macro_rules!` or an unreviewed macro name (such as `thread_local!`) | Refused, `CODE_MACRO_OPAQUE` | Refused, `CODE_MACRO_OPAQUE` |
| A bare `json!` or `info!` with no `use` in the module, or a reviewed name from another crate | Passes | Refused, `CODE_MACRO_OPAQUE` |
| A `use` that renames or glob-imports a denied module | `CODE_AMBIENT_AUTHORITY` | `CODE_AMBIENT_AUTHORITY_ALIAS` |
| `include_str!` of a UTF-8 file anywhere inside the app | Passes | Admitted, because the CLI submits every file an `include_str!` names |
| `include_str!` of a file outside the app, or of a hidden file such as `.env` | The CLI stops with an error before checking anything | Not reached: `ferrite deploy` stops with the same error before submitting |
| `include_bytes!` of a UTF-8 file under `src/` or `tests/` | Passes | Admitted, because the CLI submits those directories |
| `include_bytes!` of a binary file, or of a file in the app outside `src/` and `tests/` | Passes | Refused, `CODE_BUILD_TIME_READ`, because the CLI does not submit the file |

Store binary assets in object storage through a `blob` binding, outside the source tree. Whenever the local check and the platform check disagree, `ferrite check --remote` gives the authoritative verdict that governs a deploy.
