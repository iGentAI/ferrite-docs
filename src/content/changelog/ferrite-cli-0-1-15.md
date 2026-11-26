---
title: "Ferrite CLI 0.1.15"
date: 2026-10-05
docLink: /developers/cli/
authors: ["Ferrite Team"]
---

Ferrite CLI 0.1.15 fixes message identity in Forge's local WebSocket gateway
and adds a read-only queue inspection method to the packaged SDK. Its SDK
twin is `sha256:58726c90424d195c4db7434677f4afbab86a38a6e3f080195ef5955aab764276`.
Run `ferrite --version` to check the binary and SDK installed on your machine.

## WebSocket message identity

Forge assigns a different idempotency key to each WebSocket OPEN, text,
binary, and CLOSE envelope. The correlation ID stays the same for the
connection, and queue redelivery preserves the original envelope's key.
Two messages with identical bodies still receive different keys.

This fixes a local failure in which a second client message could collide
with an earlier message after its response had arrived but before the
application acknowledged its queue lease. The regression test uses one real
WebSocket connection and a loopback HTTP provider; it does not make a paid
provider call.

## Read queue dispositions

The packaged SDK adds `QueueClusterClient::dispositions(&ids)` and the corresponding
Forge operation. It returns one disposition class for each requested message
ID: absent, pending, acknowledged, dead-lettered, or delivery-gated. Reading
dispositions does not lease, acknowledge, or redeliver a message.

## Upgrade existing projects

The CLI's `ferrite dev` command uses the updated Forge runtime. A project
created by `ferrite new --with-tests` receives the updated vendored Forge
source and SDK. Upgrading the CLI does not rewrite an existing project's
`vendor/` directory. Review and refresh that project's vendored code
separately before expecting its tests to use this fix. The SDK twin digest
covers the SDK's ten source inputs, not Forge, so it cannot detect a stale
vendored Forge runtime.

This release does not change hosted Core or establish hosted provider,
OAuth, or fleet acceptance. Keep a declared route rate limit intact. If a
target fleet refuses that limit, retain the deployment hold rather than
removing the limit to make the deployment pass.
