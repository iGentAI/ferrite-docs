---
kind: lesson
course: agent-ready
title: Declare what an assistant can do
description: "Add the agent-ready package, declare list_classes and book_class, and route discovery and MCP requests through one handler that calls the studio's booking function."
order: 1
---

Maintaining separate `llms.txt` files, OpenAPI specs, and MCP tool definitions
guarantees they will drift out of sync with your handlers. The `agent-ready`
package derives all of them from one Rust `Surface` declaration and routes
incoming tool calls into the booking functions the studio already has.

## Add the package

From the studio directory, install `agent-ready`:

```bash
ferrite add agent-ready
```

The CLI copies the package source into `src/agent_ready/`, pulls its
dependencies, records them in `ferrite-packages.json`, and prints the module
declarations to wire into your crate root:

```text
installed from https://packages.ferrite.cloud/registry.json (index serial 88, ...):
  http-change-password v2.0.0 → src/http_change_password/ (1 file)
  http-query v1.0.1 → src/http_query/ (1 file)
  sha256-hmac v2.0.1 → src/crypto/ (6 files)
  agent-ready v1.11.2 → src/agent_ready/ (21 files)
23 file(s) written, 6 already current
recorded in ferrite-packages.json
...

wire it in: declare each mount at your crate root, e.g. in src/lib.rs:
  pub mod http_change_password;
  pub mod http_query;
  pub mod crypto;
  pub mod agent_ready;
```

Exact versions and file counts depend on the registry and on the copy of
`src/crypto/` that Alloy already installed. Add `pub mod http_change_password;`,
`pub mod http_query;`, and `pub mod agent_ready;` to the top of `src/lib.rs`,
next to `pub mod alloy;` and `pub mod crypto;`. Like Alloy, these files are
vendored package source; leave them untouched.

Two small dependencies come along with the package. `http-change-password`
handles `/.well-known/change-password`, which returns `404 Not Found` here
because the studio has no password page. `http-query` parses query strings such
as `?format=md` on content routes.

If `ferrite add` exits with `Select a Ferrite instance first or pass --registry; no default registry is assumed`,
the CLI has no active account to resolve the registry from. Complete the
account setup in lesson 1 of
[Build a booking app with Alloy](/academy/ship-an-alloy-app/), or pass the
public registry explicitly:

```bash
ferrite add agent-ready --registry https://packages.ferrite.cloud/registry.json
```

## Forward the MCP header

MCP clients send an `mcp-protocol-version` header, and the endpoint can only
inspect it if the route forwards it. In `ferrite.json`, append
`"mcp-protocol-version"` to the `/` route's `forward_headers` list while
keeping the existing headers:

```json
"forward_headers": ["accept", "cookie", "origin", "sec-fetch-site", "content-type", "x-csrf-token", "mcp-protocol-version"]
```

## Declare the surface

Create `src/agent.rs` from
[The finished studio](/academy/ship-an-alloy-app/finished-studio/#srcagentrs)
and add `pub mod agent;` to `src/lib.rs`. The module has three parts.

First, `surface()` builds a `Surface` containing the studio's name, fallback
origin, an assistant-facing description, and one API route with two operations.
Keep `PUBLIC_ORIGIN` at the top of the file set to `http://localhost:8787`. It
is used only when a request arrives with no host header. On every normal
request, the dispatch handler calls `.served_at(req.verified_host())`, which
rewrites every absolute URL in the discovery documents to the host the gateway
served (`http://` for `localhost`, `127.0.0.1`, and `[::1]`; `https://` for any
other host). Deployed discovery links follow the live domain with no code
changes.

Because an assistant chooses tools from their descriptions and JSON schemas,
each `Operation` spells out what it changes, how to retry safely, and what
refusal to expect:

```rust
Operation {
    name: "book_class".into(),
    method: "POST".into(),
    path: "/api/bookings".into(),
    description: "Book one space in a class for one person. Send the same request_id when \
                  you retry, so a retry with that request_id doesn't book twice. Refused \
                  with class-full when no spaces are left."
        .into(),
    input_schema: Some(serde_json::json!({
        "type": "object",
        "properties": {
            "class_id": { "type": "string", "description": "An id from list_classes" },
            "name": { "type": "string", "minLength": 1, "maxLength": 80 },
            "request_id": { "type": "string", "description": "A unique id you choose for this booking" }
        },
        "required": ["class_id", "name", "request_id"],
        "additionalProperties": false
    })),
    output_schema: None,
    read_only: false,
    idempotent: true,
    price_micros: 0,
}
```

Setting `read_only: false` sets MCP's `readOnlyHint` annotation so clients know
the call mutates state. Treat that hint as advisory; `book()` enforces class
capacity on the server regardless of what the client does with it.

Second, `Pages` supplies a Markdown representation of the timetable page for
clients that request `text/markdown` or a `.md` variant.

Third, `run_tool()` executes incoming tool calls by calling the same
`availability()` and `book()` functions used by the JSON API. It constructs the
booking request key as `agent:REQUEST_ID` from the `request_id` argument. Every
MCP call arrives as a new HTTP request with a fresh correlation ID, so
`request_id` is what prevents a retried tool call from claiming a second seat.
`POST /api/bookings` derives the same key when a caller passes `request_id` in
the request body.

## Route requests through the handler

In `dispatch()`, place this block ahead of the `/__alloy/action/` check:

```rust
let surface = agent::surface().served_at(req.verified_host());
if let Some((status, content_type, body, headers)) = agent_ready::well_known::handle_h(
    &surface,
    &req.method,
    &req.path,
    &req.headers,
    &req.body,
    &agent::Pages,
    |name, args| agent::run_tool(ctx, name, args),
)
.await
{
    let mut reply = IngressReply::new(req.correlation_id.clone(), status, body);
    reply.headers.push(("content-type".into(), content_type.into()));
    for (name, value) in headers {
        reply.headers.push((name.into(), value));
    }
    return Ok(reply);
}
```

`handle_h` answers the paths owned by `agent-ready`, including `/llms.txt`,
`/llms-full.txt`, `/.well-known/api-catalog`, `/openapi.json`, `/mcp`,
`/server.json`, `/.well-known/mcp/server-card.json`, `/.well-known/agent-card.json`,
the A2A 0.3.0 endpoint `/a2a`, `/.well-known/agent-readiness`, Markdown twins
requested via `Accept: text/markdown` or `.md`, `/robots.txt`, and
`/sitemap.xml`. For every other path it returns `None`, and your own routes
handle the request. Route custom `/robots.txt` or `/sitemap.xml` handlers
before `handle_h` if your app needs them. This course does not use the A2A
endpoint.

Preserve every response header returned by `handle_h` on `reply.headers`. A
Markdown response served at a page's URL includes `Vary: Accept` so downstream
caches keep the HTML and Markdown variants separate.

## Check and test

Verify that the crate compiles cleanly and the existing tests still pass:

```bash
ferrite check
ferrite test
```

The five booking tests from the launch course pass:

```text
test a_booking_decided_from_a_stale_count_is_refused ... ok
test a_class_takes_bookings_until_it_is_full ... ok
test simultaneous_bookings_never_exceed_capacity ... ok
test simultaneous_retries_of_one_request_book_once ... ok
test unknown_classes_and_bad_input_are_refused ... ok
```

The output also includes `the_app_boots_and_serves_its_home_page`, the smoke
test from lesson 3 of the launch course, in whatever order the test runner
executes them. Those tests cover the core booking logic; in lesson 2 you
exercise the discovery documents and MCP endpoint directly against the running
studio.
