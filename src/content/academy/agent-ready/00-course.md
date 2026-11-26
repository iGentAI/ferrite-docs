---
kind: course
course: agent-ready
title: Let a customer's assistant book a class
description: "Make the yoga studio usable by a customer's assistant: publish what it offers, expose listing and booking as MCP tools, and verify that a full class still refuses the booking."
order: 2
prerequisites:
  - "The finished studio from Build a booking app with Alloy"
  - "curl"
  - "For lesson 3: a Ferrite account with credit left, such as the one you deployed the studio with in the launch course"
  - "Optional, for lesson 3: an MCP client that can connect to a remote HTTP server, such as Claude Code"
---

When a customer asks their AI assistant to find a Saturday morning yoga class
and book a space, that assistant shouldn't have to scrape your HTML page. The
studio needs to publish what it offers, expose a booking operation an assistant
can call directly, and return a refusal the assistant can act on when a class
is full. You built the studio in
[Build a booking app with Alloy](/academy/ship-an-alloy-app/), perhaps with your
coding agent's help. A customer's assistant is a separate program acting for
someone else, bounded strictly by the surface and rules your application
exposes.

| What the customer's assistant needs | What the studio provides | Lesson |
| --- | --- | --- |
| Find out what the studio can do | `/llms.txt` and `/openapi.json`, generated from one declaration | 1 and 2 |
| Call an operation | `list_classes` and `book_class` as MCP tools at `/mcp` | 1 and 2 |
| Retry safely | A `request_id` argument used as the booking's request key | 1 and 2 |
| Act on a refusal | The class-full problem document from lesson 4 of the launch course, returned by the tool | 2 |
| Use the deployed studio | The same surface on the deployed host, connected to an MCP client | 3 |

Both MCP tools invoke the same functions behind the HTML page and JSON API. A
person clicking the page and an assistant calling `/mcp` hit the same capacity
check, with no second implementation to keep in sync. Because the studio
exposes no operations for editing the timetable or reading other people's
bookings, an assistant can do neither.

Because this studio accepts bookings without sign-in, any caller that can reach
it can book a space under any name up to each class's capacity, and no request
budget caps traffic. You can bound aggregate traffic per route with the
`http-route-budget` package, which maintains one token bucket per route across
all callers; per-caller throttling requires tracking callers in application
code. A production studio needs customer identity before taking bookings from
external assistants, which is the follow-on project at the end of lesson 3.

## Where you start

Start in the studio directory from the launch course and add the `agent-ready`
package. It generates `/llms.txt`, `/openapi.json`, and `/mcp` from one
declaration in your Rust code:

```bash
ferrite add agent-ready
```

## What you finish with

The studio answers `/llms.txt`, `/openapi.json`, and `/mcp` locally and on its
deployed host. The complete source files are in
[The finished studio](/academy/ship-an-alloy-app/finished-studio/).

## What this course doesn't cover

Discovery documents are generated strictly from what `surface()` declares. The
compiler does not cross-check them against your handlers, so keeping the
declaration aligned with your handler code is your job. Lesson 1 leaves the
existing booking tests untouched, and lesson 2 verifies the discovery and MCP
endpoints against the running studio.

The studio's MCP tools are public. An assistant calling `/mcp` is a separate
client without a browser session cookie, so a tool cannot tell which customer
an assistant represents unless the assistant sends a credential the tool
verifies. Issuing and checking delegated credentials is outside this course.

The `agent-ready` package also ships three capabilities this studio leaves
unused: an A2A agent card and endpoint following A2A version 0.3.0, payment
challenges for priced operations, and caller classification from signed agent
requests (parsed without cryptographic verification).

## How long it takes

Adding the package takes about a second. Checking and running the local test
suite in lesson 1 takes under a minute on a typical machine, and the local
`curl` sequence in lesson 2 takes a few minutes. Lesson 3 adds one deployment,
whose remote build typically takes three to eight minutes while the platform
compiles your checked source.
