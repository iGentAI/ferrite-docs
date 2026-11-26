---
title: Read app logs safely
description: Read recent stdout and stderr lines from deployed workers with ferrite logs, understand the retention caps and tracing gate rules, and keep secrets out of captured output.
topics: ["logs", "cli"]
updated: 2026-11-16
---

Ferrite captures stdout and stderr from every worker running your app and holds a bounded tail of recent lines for debugging. You can read that tail from the CLI or through your coding agent. Older lines roll off as new output arrives, so treat logs as a live diagnostic buffer.

## Read recent output

Run `ferrite logs` with your deployed app ID:

```bash
ferrite logs APP_ID
```

`APP_ID` takes the form `ACCOUNT/NAME`, where `NAME` matches `ferrite.json`. Inside a project directory, running `ferrite logs` with no arguments reads the app declared in `ferrite.json`, and passing the bare `NAME` works as well. Ask your agent to call `list_apps` if you need to look up deployed app IDs.

The output opens with a header line naming the app and the line count, ordered oldest to newest (newest last). Each line begins with the capturing worker name and a tag: `[out]` for stdout or `[err]` for stderr. Final lines from a crashed instance stay readable, which preserves startup failure output.

Lines tagged `[host]` come from the platform itself in two forms:

- A process exit record that gives the instance, attempt number, and exit status.
- An ended instance-set summary (for example, when a new deployment replaces a running generation) that gives the set's generation, end time in milliseconds since the Unix epoch, reason, and count of stopped processes.

Each ended instance set retains only its last 20 lines, with each line cut at 1,024 bytes and marked `[truncated]` where clipped. Each worker keeps the three most recently ended sets, so the opening lines of a long error from a crashed instance may already be gone.

Only the account that owns an app can read its logs. An ownership error means either you are authenticated as a different account or no deployed app in the active account has that ID. Call `list_apps` through your agent to compare, or see [Check which account you are using](/kb/guide/check-which-account-you-are-using/).

## Log limits

Captured output is subject to three hard bounds:

- Each worker retains the newest 20 lines per running instance, alongside the ended instance sets described above.
- Lines longer than 8 KiB are split into chunks of roughly 8 KiB, with every piece except the last marked `[truncated chunk]`.
- `ferrite logs` returns at most the last 100 lines. Because lines are grouped by worker, all 100 lines for a multi-worker app can come from a single worker. To fetch more, have your agent call the MCP `logs` tool with a higher `tail` argument; `tail: 0` returns every retained line.

Because older lines are evicted continuously, an empty or short tail never proves that an event did not occur. Write durable records your application depends on, such as orders or audit events, to your app's own storage.

## When the tail is empty

An empty tail by itself is ambiguous, and the CLI reports it explicitly: it prints `no captured lines` followed by diagnostic steps. If the app has no active deployment (because it was withdrawn or never deployed), `ferrite logs` reports that explicitly and exits with status `2`.

To tell whether your app produced no output or log capture failed, print a probe line inside a request handler, trigger that request, and check the tail again:

```rust
println!("probe: handled {}", path);
```

If that line shows up, log capture is working and the missing output was never written to stdout or stderr. If the probe line does not appear, the capture pipeline is at fault; report the issue with your app name and the time of the request.

Because the tail records stdout and stderr directly, `println!` and `eprintln!` are the most reliable way to emit lines into it. The SDK also re-exports `tracing`; import the module and invoke macros through that import:

```rust
use ferrite_app::tracing;

tracing::info!("handled {} in {}ms", path, elapsed);
```

The source gate admits three forms: `tracing::info!` with `use ferrite_app::tracing;`, the full path `ferrite_app::tracing::info!`, and a bare `info!` paired with `use ferrite_app::tracing::info;` in the same module. It rejects a bare `info!` with no same-module `use` as `CODE_MACRO_OPAQUE`. When that rejection occurs on a submitted build, it surfaces only after the full remote build completes. Local `ferrite check` does not catch it, while `ferrite check --remote` and the pre-submission gate in `ferrite deploy` catch it before submission.

Passing the gate does not guarantee that `tracing` events reach the tail. If `tracing` output is missing, log those lines with `println!` or `eprintln!` instead.

## Keep secrets out of logs and transcripts

Never write passwords, bearer tokens, cookies, `Authorization` headers, provider API keys, claim links, password-reset links, signed identity assertions, or customer personal data to stdout or stderr. Log a correlation ID, a non-identifying resource reference, the operation name, and the outcome instead.

Ferrite secrets are write-only on the management plane and never returned by a read. At runtime, however, your application receives the plaintext secret value (and can send traffic only to its declared egress hosts). A secret therefore enters logs whenever your own code prints it, such as in an error message that dumps request headers. When your coding agent reads the log tail, every captured line enters the agent's conversation and travels wherever that transcript goes.

Before sharing log snippets:

- Trim the excerpt to the lines around the failure, and note the UTC timestamp and correlation ID.
- Scan every line for the sensitive values listed above and replace each one with a placeholder such as `[token removed]`.
- If a secret reached the log, rotate it at the provider that issued it. Stripping a secret from a shared message never makes an exposed credential private again; see [Respond to an exposed credential](/kb/guide/respond-to-an-exposed-credential/).

See [Logs and observability](/developers/logs/) for structured events, account notifications, and usage telemetry.
