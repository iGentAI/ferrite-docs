---
kind: course
course: ship-an-alloy-app
title: Build a booking app with Alloy
description: "Set up your coding agent, run the live-counter starter, and build and deploy a yoga studio booking app that refuses bookings when a class is full."
order: 1
prerequisites:
  - "A terminal on macOS on Apple silicon, Linux on x86-64, or Linux on ARM64 (glibc 2.34 or newer)"
  - "Rust installed with rustup; the generated project pins Rust 1.89.0, and rustup downloads it on first use"
  - "A coding agent that can run terminal commands, such as Claude Code, Codex, or Cursor, for lesson 1"
  - "A Ferrite account, created by your coding agent in lesson 1. Unless you ask for a durable account, setup creates a 48-hour trial account (called a temporary account in the CLI) with $5 of credit, one instance per app, 256 MiB of memory, and half a CPU. Sign in through its claim link to keep it past 48 hours."
  - "curl"
  - "Enough Rust to read a function and act on compiler errors"
---

You start from an empty directory and finish with a live booking application for a yoga studio running on Ferrite. The app renders a weekend class timetable, accepts bookings through an HTML form and JSON API, persists state across reloads, and enforces an atomic capacity rule so a request for a full class fails with a clear reason.

This same application carries forward into the next course, [Let a customer's assistant book a class](/academy/agent-ready/), where a customer asks their own assistant to find a Saturday class and book a space under the studio's rules.

## Where you start

Lesson 1 runs the Ferrite quickstart prompt through your coding agent to install the CLI, connect your account, and deploy the live-counter starter. That verifies your toolchain, credentials, and hosted build path before you write booking logic. From lesson 2 onward, you work from the released CLI's Alloy template with no extra tooling dependencies:

```bash
ferrite new alloy yoga-studio --with-tests
```

## Is this course for you

Ferrite runs Rust backend applications bound to the routes, storage handles, and compute limits declared in `ferrite.json`. Every deployable app names one Cargo dependency, `ferrite-app`, so an existing Node, Python, or Rails service has to be rewritten to run here. This course builds a fresh Rust backend from the CLI template and stores bookings and per-class counts by key in Ferrite's atomic storage service.

## What you finish with

Lessons 3 and 4 walk through each part of the booking code and pull the longer rendering and API functions from [The finished studio](/academy/ship-an-alloy-app/finished-studio/). By the end, your project contains a server-rendered timetable page, a JSON API with `GET /api/classes` and `POST /api/bookings`, integration tests that fill a class to capacity and verify the refusal, and the manifest you deploy.

The studio's manifest declares 256 MiB of memory and half a CPU per instance, which matches the ceiling of a trial account. Lesson 5 uses `ferrite cost` to read projected deployment charges at current platform rates before you deploy.

## How long it takes

Plan to spend most of your time reading and modifying the code in lessons 2 through 4. Installing the CLI and downloading Rust 1.89.0 takes under a minute on a typical connection.

On a fresh project, the first `ferrite check` and `ferrite test` are the slowest local steps because Cargo compiles the vendored framework. Expect roughly 10 to 15 seconds for the first check and 40 to 50 seconds for the first test run on a standard workstation; subsequent checks finish in a few seconds. In lesson 5, the hosted deployment build takes three to eight minutes while the platform compiles your checked source and reports progress back to the CLI.
