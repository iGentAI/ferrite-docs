---
kind: lesson
course: ship-an-alloy-app
title: Show the timetable
description: "Declare the bookings APE service, replace the template notes model with a timetable, and render live seat counts for each class."
order: 3
---

A booking page has to read live seat counts from atomic storage before it can safely enforce a capacity limit. Wiring up the `bookings` storage service, replacing the template's notes model with the studio's timetable, and rendering each class against its live booked count establishes the exact key layout and read path that the booking transaction guards in the next lesson.

## Declare the bookings storage

Bookings require atomic multi-key storage because admitting a reservation has to commit the class's seat count, the booking record, and a request marker in one operation. Ferrite's atomic storage primitive, APE (atomic envelope), commits up to 64 keys together or writes nothing, and a guarded commit applies only when one chosen key still holds the value you read. [Transactions](/developers/transactions/) covers both limits.

Open `ferrite.json` and add the `bookings` service to the `services` array:

```json
{ "name": "bookings", "primitive": "ape",
  "workload": { "read_qps": 50, "write_qps": 5, "record_size_kb": 0, "keying": "PerKey", "hot_set_gib": 0 } }
```

The `workload` block sizes the service the same way the template sizes its other services. Omitting `workload` assigns a larger default reservation on deploy, which can exhaust a shared plane group.

Add the matching handle to the application's `bindings` array:

```json
{ "handle": "bookings", "kind": "ape", "service": "bookings" }
```

Your application now accesses this storage through `ctx.ape("bookings")`.

Keep the template's other bindings intact. Alloy relies on three of them directly: `requests` delivers incoming HTTP requests, `tags` stores cache epochs and action markers, and `cache` holds the leases Alloy acquires to deliver queued action effects. The `data` store belonged to the template's notes app; the studio stops reading it, though the finished manifest keeps it so the manifest stays close to the template.

## Replace the model

In `src/lib.rs`, delete the `Note` struct starting at its `/// The one stored record.` comment through everything before the `/// The route table.` comment above `fn routes()`. That removes `NOTE_PREFIX`, `MAX_NOTES`, `NOTES_TAG`, `ADD_NOTE`, and `SEEDED`, along with `note_key`, `put_note`, `notes`, and `seed`. Replace that section with the timetable model and live availability reader:

```rust
/// One class on the timetable.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(crate = "ferrite_app::serde")]
pub struct Class {
    pub id: String,
    pub title: String,
    pub starts: String,
    pub capacity: u32,
}

/// The timetable lives in code for this tutorial.
const TIMETABLE: &[(&str, &str, &str, u32)] = &[
    ("sat-0900-vinyasa", "Vinyasa flow", "Saturday 09:00", 3),
    ("sat-1100-yin", "Yin", "Saturday 11:00", 2),
    ("sun-1000-beginners", "Beginners", "Sunday 10:00", 4),
];

pub fn classes() -> Vec<Class> {
    TIMETABLE
        .iter()
        .map(|(id, title, starts, capacity)| Class {
            id: (*id).to_string(),
            title: (*title).to_string(),
            starts: (*starts).to_string(),
            capacity: *capacity,
        })
        .collect()
}

pub fn find_class(id: &str) -> Option<Class> {
    classes().into_iter().find(|class| class.id == id)
}

/// A class with its current number of booked spaces.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(crate = "ferrite_app::serde")]
pub struct Availability {
    #[serde(flatten)]
    pub class: Class,
    pub booked: u32,
    pub spaces_left: u32,
}

fn seats_key(class_id: &str) -> String {
    format!("seats/{class_id}")
}

fn decode_count(bytes: Option<&[u8]>) -> u32 {
    bytes
        .and_then(|raw| core::str::from_utf8(raw).ok())
        .and_then(|text| text.parse().ok())
        .unwrap_or(0)
}

/// Every class with its booked count, read from the bookings storage.
pub async fn availability(ctx: &AppContext) -> Result<Vec<Availability>> {
    let mut bookings = ctx.ape("bookings")?;
    let list = classes();
    let keys: Vec<String> = list.iter().map(|class| seats_key(&class.id)).collect();
    let refs: Vec<&[u8]> = keys.iter().map(|key| key.as_bytes()).collect();
    let counts = bookings.multi_get(&refs).await?;
    Ok(list
        .into_iter()
        .zip(counts)
        .map(|(class, count)| {
            let booked = decode_count(count.as_deref());
            let spaces_left = class.capacity.saturating_sub(booked);
            Availability { class, booked, spaces_left }
        })
        .collect())
}
```

Keeping `TIMETABLE` as a constant lets this course stay focused on the booking write path; moving classes into storage with a staff editor is a straightforward extension once the booking rule works.

`availability()` fetches every class count in one `multi_get` call and skips caching on purpose: a customer deciding whether to book needs the live seat count.

Inside `impl AlloyApp for App`, the `seed` hook previously called the deleted `seed` function, and the template spelled out two-parameter `Result<..., AlloyError>` return types because it did not import `alloy::error::Result`. Replace `seed` with a no-op, and change the return types on `answer` and `admit` to `Result<IngressReply>` and `Result<()>` to match the imports copied in the next step (or copy the whole `impl AlloyApp for App` block from [The finished studio](/academy/ship-an-alloy-app/finished-studio/)):

```rust
async fn answer(ctx: &AppContext, req: &IngressRequest) -> Result<IngressReply> {
    dispatch(ctx, req).await
}

async fn seed(_ctx: &AppContext) -> Result<()> {
    Ok(())
}

async fn admit(_ctx: &AppContext, _req: &IngressRequest, authority: Authority) -> Result<()> {
```

## Render the timetable

Replace `routes()`, `dispatch()`, `render()`, `index_body()`, and `note_body()` with `routes()`, `dispatch()`, `notice_for()`, `render()`, and `index_body()` from [The finished studio](/academy/ship-an-alloy-app/finished-studio/). Replace the `use` lines at the top of `src/lib.rs` with the imports from that file as well, and keep the `pub mod alloy;` and `pub mod crypto;` declarations above them.

Copy the updated `BUILD` and `SHELL` constants from the finished studio too. `BUILD` must change whenever the loader payload shape changes (here from notes to classes), and the updated `SHELL` carries the timetable CSS.

The updated `dispatch()` splits traffic across three paths:

- `/__alloy/action/...` routes to the action table, as in the template.
- `/api/...` routes to `api()`, the JSON API completed in lesson 4.
- `/` renders `availability()` and turns `?booked=CLASS_ID` or `?full=CLASS_ID` (where `CLASS_ID` is a class ID such as `sat-1100-yin`) into a status notice.

`index_body()` passes every dynamic string through `escape_html_text` or `escape_html_attr`. Alloy assembles HTML directly into strings without an auto-escaping template engine, and in a production studio those class titles come from staff input.

## Remove the notes action and tests

The template's action handler and unit tests still reference the deleted notes model, so the crate will not compile until you remove them. Update `src/lib.rs`:

1. Replace `actions()` with an empty table and delete `add_note()`:

   ```rust
   fn actions() -> Actions<App> {
       Actions::new()
   }
   ```

2. Add a placeholder `api()` that lesson 4 replaces:

   ```rust
   async fn api(_ctx: &AppContext, _req: &IngressRequest, _path: &str) -> Result<IngressReply> {
       Err(AlloyError::NotFound)
   }
   ```

3. Delete both `#[cfg(test)]` blocks at the end of the file (`mod tests` and `mod demo_tests`), which exercise the notes page and the `add-note` action.

Keep `form_field()` in `src/lib.rs`; lesson 4 uses it to decode form submissions.

Keep the smoke test in `tests/smoke.rs` and add `.with_ape("bookings")` right after `.with_ape("tags")`. The smoke test binds every handle declared in `ferrite.json`, starts the app, and checks the home page response, so it needs the `bookings` binding now that `/` reads from it.

## Check the page

Run the static checks, then start the local dev server:

```bash
ferrite check
ferrite dev
```

`ferrite check` emits two warnings, `unused import: idempotency` and ``function `form_field` is never used``, because lesson 4 calls both; warnings do not fail the check. If `ferrite check` reports an error instead, diff your file against the finished studio. Compile failures here almost always come from a leftover `Note` reference (such as `note_body()` or the template's `mod tests`) or a missing `use` import.

Open `http://localhost:8787/`. The page lists three classes with `3 of 3 spaces left`, `2 of 2 spaces left`, and `4 of 4 spaces left`. The **Book** buttons post to an action that lesson 4 implements, so leave them untouched for now. Press Control+C to stop the server.
