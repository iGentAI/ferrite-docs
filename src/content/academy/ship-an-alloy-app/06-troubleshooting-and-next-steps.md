---
kind: lesson
course: ship-an-alloy-app
title: Troubleshooting and next steps
description: "Fixes for build, routing, storage, and deployment failures in the yoga studio, how to pause or withdraw the app, and three extensions to build next."
order: 6
---

Work through the matching failure below, ordered from local toolchain checks
to live deployments. Once you finish testing the studio, pause or withdraw it
to stop usage charges, or continue with the extensions at the end of the page.

## Troubleshooting

### `ferrite check` reports that cargo did not start

Rust is missing or not on your `PATH`. Install [rustup](https://rustup.rs/),
open a new shell, and run `ferrite check` again. The project's
`rust-toolchain.toml` pins Rust 1.89.0, which rustup downloads on first use.

### `ferrite check` fails after lesson 3 or 4 with an unknown type or function

Template code for notes (such as `note_body()`, `add_note()`, or `mod tests`)
is still in `src/lib.rs`, or a `use` import is missing. If errors inside
`src/alloy/` reference `crate::crypto`, `pub mod crypto;` was deleted from the
top of `src/lib.rs`; restore it. Compare your file against
[The finished studio](/academy/ship-an-alloy-app/finished-studio/).

### The page returns `500` on every route after editing the shell

Both Alloy placeholders in `SHELL` must remain byte for byte and in order:
`<!--__alloy_head-->` first, then the empty
`<script id="__alloy_data" type="application/json"></script>` element. Restore
them.

### A route resolves nothing and returns `404`

Dynamic route segments use bracket syntax (`[id]`), never colon syntax (`:id`).
A `:id` segment is matched as literal path text.

### `ctx.ape("bookings")` fails when the app starts

The `bookings` binding is missing from `ferrite.json` or uses the wrong
primitive or kind. Add the service and binding from lesson 3 with
`"primitive": "ape"` and `"kind": "ape"`.

### `ferrite test` fails with a missing binding

The test harness builds its own in-process services independently of
`ferrite.json`. Update `studio()` to call `.with_ape("bookings")` alongside
the template's services.

### Bookings from an earlier run are still there

`ferrite dev` stores local service state under `.ferrite/state`. Run
`ferrite dev --fresh` to start with empty storage.

### `ferrite check --remote` refuses code that passes locally

Run `ferrite explain CODE` with the reported gate code, fix the offending
code, and run both local and remote checks again. See
[What the gate refuses](/academy/ferrite-foundations/what-the-gate-refuses/)
for why the local and remote gates can differ.

### `ferrite deploy` was interrupted

Run `ferrite deploy wait --attempt ATTEMPT_ID` with the attempt ID printed at
submission, or `ferrite deploy resume` to continue the latest unfinished
attempt. Run `ferrite deploy status --attempt ATTEMPT_ID` to inspect the
attempt once without blocking. Do not submit a second deployment to find out
what happened.

### `ferrite deploy` is refused with `INSUFFICIENT_CREDIT`

The account balance cannot cover the deploy fee, so no build started and
nothing was charged. Check the balance with `ferrite statement`. On a durable
account, claim ownership first if unclaimed, then add credit in the dashboard.
On a trial account, sign in through its claim link to keep it first, then add
credit, as covered in
[Claim an account your agent created](/kb/guide/claim-an-agent-created-account/).
Do not create a new account to bypass the refusal.

### The deployed studio or the whole account is gone

A trial account's apps go offline after 48 hours unless someone signed in to
keep it. After a platform release, accounts also have to be recreated; see
[Prepare for a platform release](/kb/guide/prepare-for-a-platform-release/).
Your local project directory stays untouched in both cases. Connect an account
as covered in lesson 1 and run `ferrite deploy`.

### The account is wrong or its credential expired

Recover the original account instead of creating a second one. Work from the
machine that still holds the active login, or create a named token for this
machine in the dashboard under **Settings > API tokens** and import its
credentials file with `ferrite login --credentials-file`. See
[Fix sign-in problems](/kb/guide/fix-sign-in-problems/) for the full flow.
Named tokens leave credentials on other machines working.

### The deployed page works but a booking returns `409` immediately

Another caller or an earlier test already filled that class on the live host.
Pick another class, or request `GET /api/classes` to inspect current counts.

## When you've finished

The deployed studio draws on your prepaid balance for as long as it runs. To
pause compute charges while keeping stored bookings, have your coding agent
call the Ferrite `scale` tool with `0` instances for the app. An app scaled to
zero still pays for the storage its services reserve; only withdrawal ends
that charge. To delete the app and stop all billing, run `ferrite withdraw yoga-studio` or
have your agent call `withdraw`. Withdrawal cannot be undone, so export anything you need through
the app's pages or API beforehand. See
[Withdraw an app](/kb/guide/withdraw-an-app/) for both operations. A trial
account requires neither step because its apps go offline on their own after
48 hours unless you sign in to keep them.

## Next projects

### Expose the studio to customers' assistants

Continue with
[Let a customer's assistant book a class](/academy/agent-ready/) to publish
discovery documents and MCP tools over the studio's existing booking logic.

### Store the timetable

Move `TIMETABLE` out of compiled Rust into a Ferrite store, add a staff action
for creating classes, and protect it with sign-in via `ferrite add auth`.

### Let customers cancel

Cancellations require knowing who holds the reservation, so add customer
sign-in and record the authenticated subject on each booking. Because a
cancellation lowers the seat count, checking only the count creates an ABA
race: a booking that read the count before a cancellation can observe the same
count again and commit on stale state. Guard both bookings and cancellations
with a monotonically increasing version number so compare-and-swap rejects
stale reads even when the seat count returns to an earlier value.

To examine how bookings survive retries, how requests reach the app, what the
admission gate enforces, and why a studio with no outbound destinations cannot
reach anything outside the platform, read
[How a Ferrite app works](/academy/ferrite-foundations/).
