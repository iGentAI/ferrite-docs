---
kind: lesson
course: ferrite-foundations
title: What runs when you deploy
description: "Why Ferrite compiles applications from admitted source with a single SDK dependency, and how declared services and secrets enter AppContext at startup."
order: 1
---

Most hosting platforms accept an opaque artifact, usually a container image or a
compiled binary, and try to reason about its behavior after the fact. When you
ran `ferrite deploy` for the yoga studio, the CLI sent source files together
with copies of `ferrite.json` and `Cargo.toml` adjusted for the platform's
parser and builder (lesson 5 walks through that packaging step). The platform
checked the submitted source at the admission gate, compiled the crate with its
own toolchain, and started the resulting binary on a platform-assigned HTTPS
host. Local checks approximate what the platform enforces; lesson 6 explains
where the two can differ.

## Source deployment

Compiling on the platform closes the gap between what gets checked and what
runs. Because the builder compiles the exact source tree that passed the
admission gate, static rules like "exactly one dependency" apply directly to
the code that executes in production. No uninspected binary, custom build
script, or undeclared native library can slip past the check.

That guarantee costs compile time. A deployment takes roughly three to eight
minutes because the platform builds the admitted crate from scratch with its
own compiler toolchain. Lesson 5 follows a deploy stage by stage so you can see
where that time goes.

## One dependency

Open the studio's `Cargo.toml` and look at `[dependencies]`: it lists
`ferrite-app` and nothing else. Serde, JSON serialization, tracing, and every
platform service client come from that single SDK crate. Reusable modules such
as Alloy are installed into `src/` as ordinary source files by `ferrite add`,
so the admission gate inspects them under the same rules as your own handlers.

Every line of code that executes in a deployed app is therefore either readable
source verified by the admission gate or Ferrite's own SDK. No transitive graph
of third-party crates from crates.io enters the build unchecked. Additional
capabilities enter an application in one of two ways: as Ferrite packages
copied into `src/` via `ferrite add`, or as code written directly in your
crate. When an application needs to run JavaScript or WebAssembly logic, it
embeds the `qjs-engine` or `wasm-runtime` package inside the app so execution
stays within the same manifest and containment boundary. See
[Packages](/developers/packages/) for the full set of published registry
packages.

## Injected services

A Ferrite application never discovers infrastructure over the network or pulls
credentials out of process globals. At startup, the platform injects typed
clients for queues, stores, atomic storage, logs, blobs, and outbound HTTP.
Each client maps strictly to a binding declared in `ferrite.json`. Secrets
follow the same pattern: your code reads a secret through `ctx.secret`, which
places that value in the running application's memory. Lesson 7 explains the
operational and security consequences of that design.

The supported runtime surface offers no API to open raw sockets, touch the
local filesystem, spawn child processes, or inspect environment variables, and
the admission gate rejects source referencing the standard library modules for
those operations (lesson 6 lists the exact rules). Static source admission acts
as a pre-build filter, while host-level containment of the running binary
enforces the isolation boundary between applications. Lesson 7 details what
Ferrite's application host does to separate one application from another, and
[What bounds your app](/developers/why-it-is-safe/) covers each layer in full.

The yoga studio's entire entry point in `src/main.rs` fits in seven lines:

```rust
#![forbid(unsafe_code)]

use ferrite_app::app_main;

fn main() {
    app_main::<yoga_studio::App>()
}
```

`App` implements the `FerriteApp` trait, whose `run` method receives an
`AppContext`. Every service the studio touches, from the `bookings` atomic
storage binding to the incoming request queue, comes out of `AppContext` by the
exact handle name declared in `ferrite.json`. Calling `ctx.ape("bookings")?`
returns the typed client for the `bookings` binding and returns an error if the
binding is missing or declared with a different service kind.
