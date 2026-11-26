---
kind: lesson
course: agent-ready
title: Book a class through MCP
description: "Read the studio's discovery documents, list its MCP tools, book a space with a request_id, repeat the call, and read the refusal when the class is full."
order: 2
---

Before wiring up an external MCP client, exercise the local studio with `curl`
so every request, header, and JSON-RPC payload is visible on the wire. MCP
clients send the exact same `tools/list` and `tools/call` calls: after an
`initialize` handshake under protocol revision `2025-11-25`, or with no
handshake under `2026-07-28` (where `server/discover` describes the server).
The studio's stateless endpoint answers both. Because the `curl` requests below
omit both the `mcp-protocol-version` header and `params._meta`, the endpoint
serves them as `2025-11-25`.

Start the studio with an empty timetable:

```bash
ferrite dev --fresh
```

Run the remaining commands in a second terminal.

## Read the discovery documents

An assistant given only the studio's URL can fetch `/llms.txt`, a short
orientation file that links to pages, OpenAPI schemas, and tool endpoints. An
MCP client pointed directly at `/mcp` does not need it, as you will see in
lesson 3. Request `/llms.txt` from the local studio:

```bash
curl -s http://localhost:8787/llms.txt
```

The response looks like this:

```text
# yoga-studio

> A yoga studio's weekend timetable. List classes with the spaces left, then book one space for a named person. A full class refuses the booking; choose another class.

Agent-native Ferrite app (yoga-studio v1.0.0). Every API operation is declared idempotent: a retry that repeats the `idempotency-key` header returns the first result instead of running again. Errors are RFC 9457 `application/problem+json`. Content routes serve markdown via `Accept: text/markdown` or a `.md` path twin.

## Pages

- [Weekend timetable](http://localhost:8787/): This weekend's classes and how to book them.

## API

- [OpenAPI catalog](http://localhost:8787/.well-known/api-catalog): every operation with schemas
- [MCP endpoint](http://localhost:8787/mcp): the same operations as callable tools (Streamable HTTP, stateless)
- [Agent card](http://localhost:8787/.well-known/agent-card.json): identity, skills, and interfaces (A2A)
- list_classes `GET /api/classes`: List this weekend's classes with start time, capacity, and spaces left. Free and safe to retry.
- book_class `POST /api/bookings`: Book one space in a class for one person. Send the same request_id when you retry, so a retry with that request_id doesn't book twice. Refused with class-full when no spaces are left.
```

The `agent-ready` package writes the paragraph about `idempotency-key` from
each operation's `idempotent` flag; it does not deduplicate requests itself.
Your handlers enforce that guarantee: `POST /api/bookings` uses the
`idempotency-key` header as its request key when the body has no `request_id`,
and the MCP tool keys on `request_id`. Every link reflects the host on the
incoming request (`localhost:8787` here) and falls back to `PUBLIC_ORIGIN` in
`src/agent.rs` only when no host is sent.

The full OpenAPI document is served at both `/.well-known/api-catalog` and
`/openapi.json`, where `list_classes` and `book_class` appear as `operationId`
values with their JSON schemas.

If `/llms.txt` returns the timetable page or `404 Not Found`, execution never
reached `handle_h`. Confirm that the `handle_h` block appears before the
`/__alloy/action/` check in `dispatch()`.

## List the tools

Query `/mcp` for the studio's declared tools:

```bash
curl -s -X POST http://localhost:8787/mcp \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

The response returns both operations as MCP tools, with `annotations` showing
`"readOnlyHint": true` for `list_classes` and `"readOnlyHint": false` for
`book_class`.

## Book a space

Call `book_class` for the Yin class:

```bash
curl -s -X POST http://localhost:8787/mcp \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"book_class","arguments":{"class_id":"sat-1100-yin","name":"Ana","request_id":"ana-sat-yin"}}}'
```

In `structuredContent`, the response reports `"status": "confirmed"`,
`"seat": 1`, and `"repeated": false`, with `isError` set to `false`. Open
`http://localhost:8787/` in a browser and the Yin class now shows
`1 of 2 spaces left`.

Send the exact same request a second time to simulate a retry after a client
timeout. The response comes back with `"repeated": true` and seat `1`, and the
page still shows `1 of 2 spaces left`. If a second space is taken, the two
calls sent different `request_id` values.

If the endpoint returns a JSON-RPC error naming an unknown tool, check that
`name` matches an operation name in `surface()`.

## Fill the class and read the refusal

Book the last remaining space with a new `request_id`, then attempt one more
booking:

```bash
curl -s -X POST http://localhost:8787/mcp \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"book_class","arguments":{"class_id":"sat-1100-yin","name":"Ben","request_id":"ben-sat-yin"}}}'

curl -s -X POST http://localhost:8787/mcp \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"book_class","arguments":{"class_id":"sat-1100-yin","name":"Chloe","request_id":"chloe-sat-yin"}}}'
```

The first call confirms seat 2. The second is refused with the studio's
structured problem document:

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "content": [{ "type": "text", "text": "..." }],
    "structuredContent": {
      "class_id": "sat-1100-yin",
      "detail": "Yin (Saturday 11:00) has no spaces left.",
      "retryable": false,
      "type": "urn:yoga-studio:problem:class-full"
    },
    "isError": true
  }
}
```

With `isError` set to `true`, the problem `type`, and `"retryable": false`, the
assistant has everything it needs to stop retrying this class and offer another
slot. Stop the local server with Control+C.
