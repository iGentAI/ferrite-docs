---
# Held from publication: public example not yet verified. Publish as lesson 4 of agent-ready after its commands are run against the studio and their output pasted in.
kind: lesson
course: held-agent-ready
title: Agent cards and A2A
description: How the OpenAPI catalog and the A2A agent card expose your declared Surface so agents can inspect operations before calling them.
order: 6
sources:
  - packages/agent-ready/README.md
  - docs/agent-readiness.md
---

An external agent inspects a service before sending its first tool call or HTTP request. It needs two pieces of metadata: the list of operations it can call and a summary of the service that owns them. The `catalog` module generates both documents directly from the `Surface` you declared in lesson 1.

## The OpenAPI catalog

The `catalog` module serves an OpenAPI 3.1 document at `/.well-known/api-catalog` and an identical copy at `/openapi.json`. Each declared `Operation` maps straight into an OpenAPI operation: `name` becomes `operationId`, `method` and `path` map directly, `description` provides the prose an agent plans against, and any declared input and output schemas are embedded alongside them.

Because the document is generated per request from the `Surface`, it always matches your declaration. The generator does not verify your route handlers against that declaration. A declared operation without a handler, or a live handler omitted from the `Surface`, will still build and run, so test the served endpoints directly.

## The A2A agent card

The A2A agent card is served at `/.well-known/agent-card.json`. While OpenAPI targets a caller assembling HTTP requests, the agent card targets an assistant deciding whether to delegate a task to your service.

The card projects four areas from the `Surface`:

- `name` joins the `Surface` owner and name with a slash (`<owner>/<name>`).
- `description` copies the `Surface` description.
- `version` uses the declared `Surface` version, or `0.0.0` when none is declared.
- Each declared `Operation` becomes a skill with the operation's `name` and `description`, tagged `read` or `write` from `read_only` and `free` or `paid` from `price_micros`.

The card sets `url` to the origin's `/a2a` endpoint, which is the only interface it advertises. Assistants discover the MCP endpoint through `/server.json` or `/.well-known/mcp/server-card.json`, and they discover the OpenAPI document at `/.well-known/api-catalog`.

## One declaration across every discovery surface

A single change to the `Surface` updates all exposed interfaces at once. Adding an operation makes it appear in `tools/list` at `/mcp`, adds it to the OpenAPI catalog, registers it as a skill on the agent card callable through `/a2a`, and includes it in the readiness report at `/.well-known/agent-readiness`.

You can inspect both discovery documents against a running local instance:

```bash
curl -s http://localhost:8787/.well-known/api-catalog | head -20
curl -s http://localhost:8787/.well-known/agent-card.json
```

## Writing useful descriptions and schemas

Two authoring habits determine whether an agent can use these documents reliably:

1. Write operation descriptions for a planner that has never seen your UI. State what the operation does, whether it costs money, and whether retries are safe (for example: `"List things. Free; safe to retry."`).
2. Declare accurate input schemas for structured payloads. When an agent can validate arguments against the schema ahead of time, it avoids malformed calls and wasted retries.

## Protocol limits

Four constraints apply to the agent card and the `/a2a` endpoint behind it:

- The package serves A2A protocol version `0.3.0` and advertises that value in `protocolVersion`. Because the A2A specification has moved on to version `1.0`, a client restricted to `1.0` may reject the card or fail to call `/a2a`.
- The `/a2a` endpoint supports neither streaming nor push notifications, and the card reports both capability flags as `false`.
- The card declares no security schemes. An assistant discovers that an operation requires a signed-in customer only when the endpoint refuses an unauthenticated call.
- Like the OpenAPI catalog, the agent card is derived solely from the `Surface` declaration and does not verify your handlers, so exercise the live endpoints to confirm that every advertised skill executes as expected.

With the readable and callable layers generated from your `Surface`, the remaining surfaces handle refusals, per-call pricing, and caller identity through RFC 9457 errors, x402 payment challenges, and Web Bot Auth.
