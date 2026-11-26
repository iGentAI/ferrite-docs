---
kind: lesson
course: ferrite-foundations
title: What an app can reach
description: "How ferrite.json bounds every service, route, header, and outbound destination an application can touch, and how the host enforces containment at runtime."
order: 7
---

Auditing a growing backend, or reviewing code produced by a coding agent, gets hard when any function in the codebase can open a socket, read environment variables, or reach into arbitrary storage. Ferrite turns `ferrite.json` into an enforceable capability manifest so you can see everything an application is allowed to touch before reading a single line of Rust.

Look at the yoga studio's manifest from earlier lessons. It binds one queue (`requests`), two stores (`cache` and `data`), and two atomic storage services (`tags` and `bookings`). Replies need no dedicated queue on the studio because each reply goes to the group named by the incoming request's `reply_to`. The manifest declares no outbound destinations, so the studio cannot contact anything outside the platform.

At startup, the runtime hands the application a handle for each service, route, and outbound destination listed in `ferrite.json`, and nothing else. The admission gate from lesson 6 blocks source that tries to bypass those handles before compilation, and the OS-level containment described at the end of this lesson enforces the hard boundary while the process runs.

## Reviewing an app from ferrite.json

You may not read every line a coding agent generates, yet you can audit its full access boundary in one file. Start every code review with the three capability sections of `ferrite.json`:

| Manifest section | What it controls | Enforcement |
| --- | --- | --- |
| Bindings | Every platform service the app can use, identified by kind | The runtime hands out handles only for declared bindings, checked by name and kind |
| Routes | The sole entry points for public traffic, plus each route's `forward_headers` allowlist | Public requests enter only through declared routes, and the app sees only forwarded headers |
| Egress | Outbound destinations declared as `https://` URL prefixes | Every outbound request passes through the platform gateway, which records it and returns `Denied` before any network call if the URL falls outside declared prefixes; destinations on the platform's own domain (including other Ferrite apps) are refused at manifest admission |

Once `ferrite.json` matches the access boundary you expect, read `book()` and its tests to verify the booking logic itself. The manifest bounds what the application can reach; your Rust code owns the rules it enforces inside that boundary.

## Secrets, internal calls, and caller identity

Removing ambient authority changes three everyday backend patterns in concrete ways.

### Secrets

Because an application cannot read environment variables or host files, secrets come through the platform's secret store. Set a secret with `ferrite secrets set NAME`, which reads the value from stdin or `--value-file` so secrets never sit in shell history or process argument lists. Manage existing entries with `ferrite secrets list` and `ferrite secrets delete NAME`, or through MCP with `set_secret`, `list_secrets`, and `delete_secret`. Inside the application, `ctx.secret("NAME")` returns `Option<String>` and `ctx.secret_names()` lists the available names.

Secrets are write-only from the management plane: once stored, no read API returns the secret value. Inside the running process, your code receives the value and can send outbound traffic only to declared egress prefixes. Because the value is in memory and is not bound to a specific egress destination, application code could still log it, return it in a response, or persist it to storage. Review how your code handles every secret it reads.

A secret reaches a running instance only through a deploy, which runs a full build and incurs a deploy fee even when source files have not changed. Updating a secret with `ferrite secrets` marks the project changed so the next `ferrite deploy` submits a build automatically. If you updated the secret through MCP, run `ferrite deploy --force` to deliver it. See [Secrets & Egress](/developers/secrets-egress/) for the full contract.

### Private app-to-app calls

Private communication between Ferrite applications runs over queues. Egress handles only external HTTPS endpoints: any destination on the platform's own domain is rejected when the manifest is admitted, and applications have no way to open raw sockets.

### Caller-supplied identity

A request header or body field claiming a user identity proves nothing until the application verifies it, for example against a session the application established itself. The yoga studio accepts any caller-supplied name on a booking because it has no need to identify customers. Adding a feature where customers cancel their own bookings requires real sign-in, which you can add with `ferrite add auth`.

## How the platform separates applications

In its required containment mode, Ferrite's application host launches every application instance under its own unprivileged OS user drawn from a pool, so two applications on the same machine never share a user ID. Each instance starts with zero Linux capabilities and with `NO_NEW_PRIVS` enabled. It runs inside private mount, process, and network namespaces whose network stack has no route of its own. A system-call filter denies privileged calls such as mounting and tracing, and a cgroup enforces hard memory and CPU limits. If the host cannot establish every one of those bounds, the program does not start. Outbound traffic to declared destinations travels exclusively through relays the host holds open to those exact destinations.

See [What bounds your app](/developers/why-it-is-safe/) for a layer-by-layer breakdown of host isolation.

Within that sandbox, domain rules stay yours: who is authorized to perform an action, which inputs are valid, what payloads go to a declared egress host, and what commitments the application makes to its users. Continue to [Authorization](/developers/authorization/) for how to structure the authorization boundary inside your app.
