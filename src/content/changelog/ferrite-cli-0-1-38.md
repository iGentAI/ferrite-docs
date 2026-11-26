---
title: "Ferrite CLI 0.1.38"
date: 2026-11-17
docLink: /developers/cli/
authors: ["Ferrite Team"]
---

Ferrite CLI 0.1.38 adds a Linux ARM64 build, says plainly when the platform
no longer knows your login, and gives `ferrite mcp-serve` the app discovery
and lifecycle tools it lacked. The installer at
`https://downloads.ferrite.cloud/install.sh` installs this release; run
`ferrite --version` to check the binary on your machine.

## Linux ARM64

The installer now selects an archive for Linux on ARM64 (aarch64) beside
macOS on Apple silicon and Linux x86-64. Both Linux builds need glibc 2.34 or
newer, and musl systems such as Alpine are not supported. As for the other
platforms, the installer verifies the release signature on the published
checksum list and then the archive's checksum before it installs anything.

## A login the platform does not know

During the beta a platform release can erase accounts, so a login from before
the last release may be answered with HTTP 401 `invalid_token`. Every command
that meets that answer now reports that the login is not known to the
platform at your endpoint and may predate a platform release, and names the
two ways forward: `ferrite login --endpoint <endpoint> --ephemeral --json` for
a fresh trial account, or `ferrite login --credentials-file <file>` to import
a Dashboard API token. `ferrite account --json` exits `3` with `reason`
`LOGIN_UNKNOWN_TO_PLATFORM`, `credentialKept: true` and those commands in
`next`.

The CLI never deletes the stored credential. When one of those login commands
replaces it, the previous document is kept beside the new one as
`credentials.toml.replaced-<seconds>`. See
[Sign-in stopped working after a platform release](/kb/guide/sign-in-stopped-working-after-a-platform-release/)
for the whole procedure.

## More tools in `ferrite mcp-serve`

The CLI's built-in MCP adapter now forwards the hosted reads for app discovery
and description, usage, releases and deploy history, ownership
(`remote_owner_status` and `remote_claim_url`) and domains. Its rollback,
scaling and withdrawal tools are refused before any credential is read unless
the call carries `confirm: true`. Binding domains, promotion and the other
control-plane tools still need the hosted MCP endpoint.
