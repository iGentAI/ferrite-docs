---
kind: course
course: ferrite-foundations
title: How a Ferrite app works
description: "How Ferrite compiles admitted source, routes HTTP traffic through queues, guards atomic writes against retries, enforces platform limits, and isolates running apps."
order: 3
prerequisites:
  - "The yoga studio from Build a booking app with Alloy, or another app created with ferrite new"
  - "Rust basics"
  - "The Ferrite CLI, logged in to a Ferrite account, for commands that query the platform such as ferrite check --remote"
  - "Your local copy of that project. Several lessons inspect and test it locally, and lesson 5 walks through deploying it again if you want a running copy."
---

Deploy the yoga studio from
[Build a booking app with Alloy](/academy/ship-an-alloy-app/) and several
deliberate design choices become visible right away. Sending the same booking
request twice returns the original booking and leaves the seat count untouched.
The application never binds a TCP port; it pulls HTTP requests off a queue and
publishes replies back. And `ferrite check` refuses Rust code that `rustc`
compiles without complaint.

Each of those behaviors comes from the same premise: the platform controls the
boundary around every application so the code inside stays small, auditable,
and safe under retries and concurrency. The eight lessons use the yoga studio
you already built as a working reference and trace the full path from source
submission to runtime isolation:

| Lesson | Topic |
| --- | --- |
| 1 | Source deployment, the single-dependency rule, and services injected at startup |
| 2 | Gateway routing, queue-backed request envelopes, and header forwarding |
| 3 | Guarded atomic writes that stay accurate across retries and concurrent races |
| 4 | Storage, ingress, timeout, expiry, concurrency, and account bounds that shape design |
| 5 | What happens across each stage of a deployment |
| 6 | What the admission gate rejects and where local checks differ from remote checks |
| 7 | Isolation between applications, secrets held by the runtime, and the authorization rules that remain in your code |
| 8 | Reference to the services a Ferrite app can bind |

Nothing new needs to be installed. Keep your local studio directory open,
because several lessons have you inspect a function in it or run CLI commands
against it. The first command is `ferrite test` in lesson 3. Once you have
finished all eight lessons, the customer-identity project at the end of
[Let a customer's assistant book a class](/academy/agent-ready/) is a direct
next step: it puts lesson 7's application authorization boundary to work on the
same codebase.
