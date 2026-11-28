---
title: Get help from the Ferrite team
description: Contact the Ferrite team for troubleshooting, security reports, or architecture questions, and see what to include in your first message.
topics: ["support"]
updated: 2026-11-16
featured: true
---

The three people who run Ferrite read and answer support email themselves. Write when a guide does not solve your problem, when you suspect a bug or an exposed credential, or when you want to check whether Ferrite fits a product you plan to build.

## Contact the team

Email [info@igent.ai](mailto:info@igent.ai?subject=Ferrite%20support) with `Ferrite support` in the subject line. You do not need an active dashboard session, so use this route whenever you are locked out.

If your durable account needs credit and **Usage & billing** shows purchasing is disabled, include the account ID and explain what you want to deploy. Trials cannot receive additional credit. To keep a trial and its apps, use its [claim link](/kb/guide/claim-an-agent-created-account/) first.

## Report a security issue

Send security reports privately to [security@ferrite.cloud](mailto:security@ferrite.cloud?subject=Ferrite%20security) with `Ferrite security` in the subject line. Include the affected product, reproduction steps, and impact, and omit passwords, tokens, and personal data. The [security contact record](/.well-known/security.txt) lists this channel and its expiry date.

## Ask whether Ferrite fits

Ferrite runs Rust backend applications written by coding agents, each bounded by the capabilities declared in its manifest. Describe the product you have in mind and the tasks you want customers or their agents to run.

## Send what the team needs

For a failure, include everything in the [Report a bug](/kb/guide/report-a-bug/) checklist: the exact error text, the UTC time, the CLI version, the account ID and endpoint, and the identifiers for the surface that failed. For a product-fit question, send the workflow description above.

Never include a Ferrite token, your credential file, a claim link, a password, a browser cookie, or a secret value. The team needs none of them to investigate. If a credential leaked, revoke or replace it first ([Respond to an exposed credential](/kb/guide/respond-to-an-exposed-credential/)), then name the credential type and where it appeared.

## What the team can't do

Save yourself a round trip by checking these hard boundaries first:

- Reissue credentials for an account removed by a [platform release](/kb/guide/prepare-for-a-platform-release/).
- Recover an app or its data once 30 days have passed after a zero balance.
- Raise a trial account's limits or add credit to it.

## Guides for first-session problems

- [Fix sign-in problems](/kb/guide/fix-sign-in-problems/)
- [Sign-in stopped working after a platform release](/kb/guide/sign-in-stopped-working-after-a-platform-release/)
- [Prepare for a platform release](/kb/guide/prepare-for-a-platform-release/)
- [Claim an account your agent created](/kb/guide/claim-an-agent-created-account/)
- [Check which account you are using](/kb/guide/check-which-account-you-are-using/)
- [Fix a failed deployment](/kb/guide/fix-a-failed-deployment/)
- [Find your app's URL](/kb/guide/find-your-app-url/)
- [Understand usage and credits](/kb/guide/usage-and-credits/)
- [Respond to an exposed credential](/kb/guide/respond-to-an-exposed-credential/)
- [Report a bug](/kb/guide/report-a-bug/)
