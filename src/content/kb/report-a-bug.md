---
title: Report a bug
description: Include the exact error text, UTC timestamp, and failing-surface identifiers in your first message so the Ferrite team can reproduce the problem without a credential.
topics: ["support"]
updated: 2026-11-16
---

Give the Ferrite team enough detail in the first message to reproduce the failure: exact error text, the identifiers for what failed, the UTC time, and the steps that triggered it. You never need to send a credential.

## Before you report

If a stored credential stopped working or your account and apps disappeared after a platform release, that is expected behavior after a clean release installation. Follow [Sign-in stopped working after a platform release](/kb/guide/sign-in-stopped-working-after-a-platform-release/) to start a new account and redeploy.

## Include the basics

Put these details in every report:

- What you tried to do, what you expected, and what happened instead.
- The exact error output copied as plain text instead of a screenshot.
- The UTC date and time when the failure occurred.
- The output of `ferrite --version` if you used the CLI.
- Your account ID and endpoint from `ferrite account`. If you work only through an agent's Ferrite tools, ask the agent to call `account`, include the returned account ID, and name the agent and Ferrite connection you use.
- The smallest sequence of steps that reproduces the problem, if you can isolate one.

## Add the identifiers for the failing surface

Attach the identifiers matching whichever part of the platform failed:

| Surface | Identifiers to include |
| --- | --- |
| Deployment | Deployed app ID (if created), attempt ID, build ID (if printed by the CLI), and the reasons the CLI reported. The project keeps the same reasons under `.ferrite/deployments/`. |
| Dashboard | Page URL and the error's request reference, which starts with `Request`. |
| Running app | Deployed app ID, HTTP method and path, HTTP status code, and your app's correlation ID if it records one. |
| Agent or MCP tool | Tool name, tool arguments with any secret values removed, and the returned result. |

When app output is part of the failure, attach only the relevant log lines. See [Read app logs safely](/kb/guide/read-app-logs-safely/) before copying logs out of a running app.

Your coding agent can gather most of this for you. Ask it to draft the report from this checklist, then inspect the draft against [Leave out credentials and private data](#leave-out-credentials-and-private-data) before sending.

## Leave out credentials and private data

Never include any of the following, even in a private email:

- Contents of `~/.config/ferrite/credentials.toml` or any Ferrite token.
- Claim links, password reset links, passwords, browser cookies, or session values.
- App secret values, provider API keys, or signing keys.
- Customer records or other personal data stored by your app.

If you already sent one of these, tell the team which type of credential was exposed and follow [Respond to an exposed credential](/kb/guide/respond-to-an-exposed-credential/) to revoke or replace it.

## Send the report

Email [info@igent.ai](mailto:info@igent.ai?subject=Ferrite%20support) with `Ferrite support` in the subject line. See [Get help from the Ferrite team](/kb/guide/get-help-from-the-ferrite-team/) for other support details.
