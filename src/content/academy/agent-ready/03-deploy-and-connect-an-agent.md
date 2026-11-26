---
kind: lesson
course: agent-ready
title: Deploy and connect an assistant
description: "Deploy the studio's agent-ready surface, check its discovery document and tools on the deployed host, and connect an MCP client to /mcp."
order: 3
---

Once deployed, the studio rewrites its discovery documents to its live HTTPS
origin and exposes `/mcp` to any remote client with the URL. Verify the target
account, ship the build, test the live endpoints directly, and connect an MCP
client to book a class.

## Confirm the account

Verify which Ferrite account will receive the deployment:

```bash
ferrite account --json
```

If the output does not match the account you intend to deploy to, fix your
active account before proceeding.

Deploying opens a second public entry point to the studio. Once live, any
assistant with the address can invoke `book_class` at `/mcp` under any name,
and no route budget caps request volume.

Deploying and running an application draw from account credits. Run
`ferrite cost` in the project directory (or have your coding agent call
`estimate_cost`) to view your current balance, the deploy fee, and each
application's projected monthly cost at current rates. It charges nothing and
makes no changes.

When an account's balance reaches zero, its applications stop. Durable accounts
retain stopped apps and their data for 30 days before permanent deletion. Trial
accounts cannot be funded and suspend apps when credit runs out. For trial
limits and credit rules, see
[Understand usage and credits](/kb/guide/usage-and-credits/).

## Deploy

Run the remote check and deploy:

```bash
ferrite check --remote
ferrite deploy
```

The CLI prints the application URL when the deployment finishes. In the
commands below, substitute that URL without a trailing slash for `APP_URL`.
Leave `PUBLIC_ORIGIN` in `src/agent.rs` at `http://localhost:8787`, since
`.served_at(req.verified_host())` sets the discovery links from the host on
each request.

## Check the deployed surface

Fetch `/llms.txt` from the deployed host:

```bash
curl -s APP_URL/llms.txt
```

Every link under `## API` should begin with `APP_URL`. If any link starts with
`http://localhost:8787`, `dispatch()` is calling `agent::surface()` without
`.served_at(req.verified_host())`.

Book one space in the Beginners class over MCP:

```bash
curl -s -X POST APP_URL/mcp \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"book_class","arguments":{"class_id":"sun-1000-beginners","name":"Ana","request_id":"deployed-ana-sun"}}}'
```

Confirm that `structuredContent` contains `"status": "confirmed"`. Open
`APP_URL` in a browser; if this was the first booking for Beginners, the page
shows `3 of 4 spaces left`.

## Connect an MCP client

Remote MCP clients connect to `APP_URL/mcp` by URL. Because booking is public
in this studio, no credentials are required.

In Claude Code, register the studio as a remote HTTP MCP server:

```bash
claude mcp add --transport http yoga-studio APP_URL/mcp
```

Here Claude Code acts as the customer's assistant, connected to the studio's
own MCP server and its two booking tools. That server is separate from
Ferrite's platform MCP server, which your coding agent uses to build and deploy
applications. If the Ferrite plugin is installed in the same Claude Code
environment, both servers appear in the session; confirm that booking calls go
to `yoga-studio`.

Start a new session and ask for a booking in plain language:

```text
Find a Saturday morning yoga class at yoga-studio with a space left and book it for Dana.
```

Which tools the assistant calls, and in what order, depends on the model and
client. Inspect the actual tool calls in the session to see whether it sent
`book_class` with a `request_id`, then reload the studio page to confirm the
seat count changed. Never rely solely on a model's prose summary of a tool
call. If the chosen class was already full, the tool returns the class-full
problem document and the page count stays unchanged.

If a client fails with an unsupported protocol version error, it sent an
`mcp-protocol-version` header naming a revision the endpoint does not serve.
The endpoint natively supports `2025-11-25` and `2026-07-28`, and treats
requests that omit both the header and `params._meta` as `2025-11-25`. It also accepts `2025-06-18` and
`2025-03-26`, which clients such as custom connectors in Claude.ai and Claude
Desktop still send: it serves those requests as `2025-11-25` and echoes the
requested revision on `initialize`. The official MCP TypeScript SDK 1.30.0
negotiates `2025-11-25` with this endpoint. Use a client that sends one of
these revisions.

## Next project

To take the studio toward production, add customer identity with
`ferrite add auth`, store the signed-in subject with each booking, and add
`list_my_bookings` and `cancel_booking` scoped to that customer on the
authenticated web page and JSON API. Guard bookings and cancellations with a
monotonically increasing version key, and keep staff operations such as editing
the timetable out of `surface()` so customer assistants never see them.

The `auth` package authenticates a human user in a browser using a session
cookie. An assistant calling `/mcp` is a separate client with no browser
cookie, so it requires its own credential that your tool handlers verify before
acting. Because every operation in `surface()` becomes an MCP tool, keep
`list_my_bookings` and `cancel_booking` out of `surface()` (or reject
unauthenticated tool calls) until your studio checks that credential. For the
authorization boundary both surfaces share, see
[Same authorization as the interface](/developers/build-for-agents/#same-authorization-as-the-interface).
For the design behind `request_id` and guarded writes, see
[Writes that survive retries](/academy/ferrite-foundations/writes-that-survive-retries/).
