---
kind: lesson
course: ship-an-alloy-app
title: Book a class and refuse a full one
description: "Enforce class capacity inside a guarded APE transaction, expose it through the HTML form and a JSON API, and verify concurrency and retry behavior."
order: 4
---

A capacity limit only holds when every booking write passes through one guarded transaction. Putting that check inside a single `book()` function backed by APE's conditional commit guarantees that the browser form, the JSON API, and any customer assistant calling the studio later enforce the same seat count under concurrent load and network retries.

## Write the booking function

Add the booking types and transaction functions to `src/lib.rs`, directly after `availability()`:

```rust
/// The result of one booking attempt.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Booking {
    /// Admitted. `repeated` is true when this request was already admitted
    /// and is being answered from its record.
    Confirmed { seat: u32, repeated: bool },
    /// Every space is taken. Nothing was written.
    Full,
}

/// What one booking attempt read: this request's marker, if it was already
/// admitted, and the class's current count.
pub struct BookingRead {
    recorded: Option<Vec<u8>>,
    count: Option<Vec<u8>>,
}

fn marker_key(class: &Class, name: &str, request_key: &str) -> String {
    format!("request/{}/{request_key}/{name}", class.id)
}

/// Read the marker and the count in one call.
pub async fn read_booking(
    bookings: &mut ferrite_app::client::ApeClusterClient,
    class: &Class,
    name: &str,
    request_key: &str,
) -> Result<BookingRead> {
    let marker = marker_key(class, name, request_key);
    let seats = seats_key(&class.id);
    let mut read = bookings.multi_get(&[marker.as_bytes(), seats.as_bytes()]).await?.into_iter();
    Ok(BookingRead { recorded: read.next().flatten(), count: read.next().flatten() })
}

/// Decide from `read` and write the booking. `Ok(None)` means the count
/// changed after it was read, so nothing was written and the caller reads again.
pub async fn commit_booking(
    bookings: &mut ferrite_app::client::ApeClusterClient,
    class: &Class,
    name: &str,
    request_key: &str,
    read: &BookingRead,
) -> Result<Option<Booking>> {
    if let Some(recorded) = read.recorded.as_deref() {
        return Ok(Some(Booking::Confirmed { seat: decode_count(Some(recorded)), repeated: true }));
    }
    let booked = decode_count(read.count.as_deref());
    if booked >= class.capacity {
        return Ok(Some(Booking::Full));
    }
    let seat = booked + 1;
    let seat_text = seat.to_string();
    let seats = seats_key(&class.id);
    let marker = marker_key(class, name, request_key);
    let record_key = format!("booking/{}/{seat}", class.id);
    let record = serde_json::json!({ "class_id": class.id, "name": name, "seat": seat }).to_string();
    let committed = bookings
        .commit_n_if(
            seats.as_bytes(),
            read.count.as_deref(),
            &[
                (seats.as_bytes(), seat_text.as_bytes()),
                (record_key.as_bytes(), record.as_bytes()),
                (marker.as_bytes(), seat_text.as_bytes()),
            ],
        )
        .await?;
    Ok(committed.is_ok().then_some(Booking::Confirmed { seat, repeated: false }))
}

/// Book one space in `class`, reading again whenever another booking
/// committed between the read and the write.
pub async fn book(ctx: &AppContext, class: &Class, name: &str, request_key: &str) -> Result<Booking> {
    let mut bookings = ctx.ape("bookings")?;
    for _ in 0..16 {
        let read = read_booking(&mut bookings, class, name, request_key).await?;
        if let Some(outcome) = commit_booking(&mut bookings, class, name, request_key, &read).await? {
            return Ok(outcome);
        }
    }
    Err(AlloyError::conflict("the class is busy; retry the booking"))
}
```

Splitting the write path into `read_booking()` and `commit_booking()` lets a test interleave two reads before either write lands and reproduce a last-seat race deterministically.

`read_booking()` fetches the request marker and the class's seat count in one `multi_get` call. `commit_booking()` evaluates that snapshot in order:

1. If the request marker already exists, the request was admitted earlier and returns `Booking::Confirmed` with `repeated: true` and the recorded seat.
2. If `booked >= class.capacity`, the class is full and returns `Booking::Full`.
3. Otherwise, `commit_n_if` writes three entries in one atomic commit: the incremented seat count, the booking record, and the request marker. The commit applies only if the seat count key still holds the exact value `read_booking()` saw.

When a competing booking commits in between, `commit_n_if` writes nothing and `commit_booking()` returns `Ok(None)`. `book()` then loops up to 16 times, re-reads both keys, and either claims the next seat, replays the recorded seat, or refuses once the class fills. Because `marker_key()` includes `class.id` and `name`, reusing a request key for a different class or attendee creates a separate booking and leaves the earlier marker untouched.

`book()` accepts no HTTP or caller metadata, so the browser form, the JSON API, and the MCP tools in the next course all pass through the exact same transaction.

Keep the platform and application boundaries distinct here. Ferrite enforces capability boundaries: your app receives handles only for the services, routes, and outbound destinations declared in `ferrite.json`. Ferrite does not know your domain rules, so a bug in `commit_booking()` deploys as written; tests have to prove capacity enforcement directly.

The studio also has no authentication yet, so anyone who can reach its URL can book under any name. [Sign-in for Alloy applications](/developers/authentication-alloy/) shows how to require a signed-in account on an action.

## Call it from the API and the form

Replace the placeholder `api()` and empty `actions()` from lesson 3 with `api()`, `booking_reply()`, `json()`, `valid_name()`, `actions()`, and `book_from_form()` from [The finished studio](/academy/ship-an-alloy-app/finished-studio/).

Those handlers wire `book()` to two JSON endpoints:

- `GET /api/classes` returns the timetable and live seat counts as JSON.
- `POST /api/bookings` accepts `{"class_id": "...", "name": "..."}` with an optional `request_id`. When `request_id` is present, the handler uses it as the idempotency key; otherwise it falls back to the `idempotency-key` header. It returns `201 Created` for a new booking, `200 OK` for a repeated request, and `409 Conflict` when the class is full.

Any client that retries must send either `request_id` or an `idempotency-key` header. Without one, every attempt counts as a new request, so retrying after a dropped response books a second space. Keys derived from the `idempotency-key` header also bind the request's method, path, and body, so retries must send the identical body. [Writes that survive retries](/academy/ferrite-foundations/writes-that-survive-retries/) explains why duplicate deliveries happen in practice.

Two distinct failure modes return `409 Conflict`, and clients should inspect the `retryable` field in the problem document:

- A full class returns `type: "urn:yoga-studio:problem:class-full"` with `retryable: false`. Repeating the request will keep failing.
- Contention exhaustion (when `book()` loses the `commit_n_if` race 16 times in a row) returns Alloy's `type: "urn:ferrite:problem:conflict"` with `retryable: true`. A client should retry the exact same request with the same key.

The browser form posts to `POST /__alloy/action/book`, calls the same `book()` function, and redirects to `/?booked=CLASS_ID` or `/?full=CLASS_ID`. Each rendered page embeds a per-render request key in its forms, so double-clicking **Book** books one space.

## Test the rule

Create `tests/booking.rs` using the test suite from [The finished studio](/academy/ship-an-alloy-app/finished-studio/). These tests boot the real application against local services and verify five behaviors:

- Sequential bookings fill the Yin class with two keys, a replay of the first key returns `200`, and a third person gets `409`.
- A deterministic stale-read test calls `read_booking()` twice for Yin before either write lands and asserts that the second `commit_booking()` returns `None` without modifying storage.
- A concurrent load test fires twelve distinct bookings at every class simultaneously and verifies that accepted bookings equal each class's capacity.
- A concurrent retry test sends the same booking request eight times simultaneously and verifies that only one seat is taken.
- Unknown class IDs, empty names, and non-JSON payloads are rejected with `404` or `400`.

Run the suite:

```bash
ferrite test
```

The output includes these six lines (order varies because tests run in parallel):

```text
test a_booking_decided_from_a_stale_count_is_refused ... ok
test a_class_takes_bookings_until_it_is_full ... ok
test simultaneous_bookings_never_exceed_capacity ... ok
test simultaneous_retries_of_one_request_book_once ... ok
test unknown_classes_and_bad_input_are_refused ... ok
test the_app_boots_and_serves_its_home_page ... ok
```

`the_app_boots_and_serves_its_home_page` comes from `tests/smoke.rs`, which you kept in lesson 3.

If a test fails at startup with an error naming the `bookings` binding, the test harness is missing that service. Verify that `studio()` in `tests/booking.rs` and the harness in `tests/smoke.rs` both call `.with_ape("bookings")`.

## Try it in the browser

Start the local server with `ferrite dev` and open `http://localhost:8787/`. Book the Yin class twice under two different names. After each submission, the page displays `You're booked into Yin (Saturday 11:00).` After the second booking, Yin reads `0 of 2 spaces left` and renders a disabled **Full** button.

In a second terminal, request one more seat over the JSON API:

```bash
curl -i -X POST http://localhost:8787/api/bookings \
  -H "content-type: application/json" \
  -H "idempotency-key: try-1" \
  -d '{"class_id":"sat-1100-yin","name":"Chloe"}'
```

The server answers `409 Conflict` with a body like this:

```json
{
  "class_id": "sat-1100-yin",
  "detail": "Yin (Saturday 11:00) has no spaces left.",
  "retryable": false,
  "status": 409,
  "title": "Class full",
  "type": "urn:yoga-studio:problem:class-full"
}
```

Stop the server with Control+C, restart it with `ferrite dev`, and reload the page. Yin remains full because the local server persists its data under `.ferrite/state`. Run `ferrite dev --fresh` whenever you want a clean timetable.
