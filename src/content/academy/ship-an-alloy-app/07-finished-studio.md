---
kind: lesson
course: ship-an-alloy-app
title: The finished studio
description: "Complete manifest, source, and tests for the yoga studio at the end of the course, plus the additions from the course on a customer's assistant."
order: 7
---

Every modified file from both courses appears below in its final state, ready
to diff against a failing workspace or copy directly when a lesson references
a function.

Start from a project scaffolded with `ferrite new alloy yoga-studio --with-tests`.
With the lesson 4 files in place, `ferrite check` passes without errors or
warnings and `ferrite test` passes the five tests in `tests/booking.rs` plus
the smoke test. After applying the additions from
[Let a customer's assistant book a class](/academy/agent-ready/), `ferrite dev`
also serves `/llms.txt`, `/openapi.json`, and an MCP `book_class` tool that
books once across retries sharing a `request_id`. Run `ferrite --version` to
check which CLI release is installed.

## `ferrite.json`

Two changes sit on top of the scaffolded manifest. First, the `bookings` APE
service and binding declare the same small `workload` profile as the other
template services. Second, the `/` route forwards `mcp-protocol-version`,
which is only needed once you follow the course on a customer's assistant. The
`/__alloy/` route keeps `origin` and `sec-fetch-site` so Alloy rejects
cross-site form posts.

The `compute` block requests 256 MiB of memory and half a CPU per instance,
which stays within a trial account's compute cap; run `ferrite cost` to check
the monthly estimate. Because the manifest declares no outbound destinations,
the runtime injects handles only for the five services listed in `bindings`,
so the deployed app cannot contact external hosts.

No `replies` queue appears in the manifest. The ingress gateway populates each
request's `reply_to` address, so the application needs no reply queue of its
own.

`rate_limit_per_min` is left out because `ferrite new` omits it and Ferrite
Cloud does not enforce that key. Both `ferrite deploy` and `ferrite cost` hold
any manifest containing `rate_limit_per_min` and explain why; keep the key if
your manifest already declares it, and do not bypass the hold through raw
`deploy_source`. See [Rate limits](/developers/rate-limits/) for the hold
details and route-level caps with `http-route-budget`.

```json
{
  "services": [
    { "name": "requests", "primitive": "queue",
      "workload": { "read_qps": 20, "write_qps": 10, "record_size_kb": 0, "keying": "PerKey", "hot_set_gib": 0 } },
    { "name": "cache", "primitive": "store",
      "workload": { "read_qps": 50, "write_qps": 5, "record_size_kb": 1, "keying": "PerKey", "hot_set_gib": 0 } },
    { "name": "data", "primitive": "store",
      "workload": { "read_qps": 50, "write_qps": 5, "record_size_kb": 1, "keying": "PerKey", "hot_set_gib": 0 } },
    { "name": "tags", "primitive": "ape",
      "workload": { "read_qps": 50, "write_qps": 5, "record_size_kb": 0, "keying": "PerKey", "hot_set_gib": 0 } },
    { "name": "bookings", "primitive": "ape",
      "workload": { "read_qps": 50, "write_qps": 5, "record_size_kb": 0, "keying": "PerKey", "hot_set_gib": 0 } }
  ],
  "applications": [{
    "name": "yoga-studio",
    "artifact_key": "apps/yoga-studio@v1",
    "artifact_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
    "bindings": [
      { "handle": "requests", "kind": "queue", "service": "requests" },
      { "handle": "cache", "kind": "store", "service": "cache" },
      { "handle": "data", "kind": "store", "service": "data" },
      { "handle": "tags", "kind": "ape", "service": "tags" },
      { "handle": "bookings", "kind": "ape", "service": "bookings" }
    ],
    "routes": [
      { "prefix": "/__alloy/", "binding": "requests", "kind": "api", "public": true, "forward_headers": ["accept", "idempotency-key", "origin", "sec-fetch-site", "cookie", "content-type", "x-csrf-token"] },
      { "prefix": "/assets/", "binding": "requests", "kind": "api", "public": true, "forward_headers": ["accept-encoding", "if-none-match"] },
      { "prefix": "/", "binding": "requests", "kind": "api", "public": true, "forward_headers": ["accept", "cookie", "origin", "sec-fetch-site", "content-type", "x-csrf-token", "mcp-protocol-version"] }
    ],
    "compute": { "memory_mb": 256, "cpu_percent": 50 }
  }]
}
```

## `src/lib.rs`

Complete application source at the end of lesson 4. Leave `src/main.rs`
unchanged from the template.

```rust
#![forbid(unsafe_code)]
//! yoga-studio: a small class-booking product on Ferrite Alloy.
//!
//! Started from `ferrite new alloy yoga-studio --with-tests`. The scaffold's
//! notes model is replaced by a timetable and bookings. The booking rule (a
//! class never takes more people than it has spaces) is enforced where the
//! write happens, so the browser form, the JSON API, and later a customer's
//! assistant all meet the same rule.

/// The Ferrite Alloy runtime, vendored as source. Never edit under here.
pub mod alloy;
/// `sha256-hmac`, a package Alloy depends on, vendored the same way.
pub mod crypto;

use ferrite_app::serde::{Deserialize, Serialize};
use ferrite_app::{serde_json, AppContext, FerriteApp, IngressReply, IngressRequest};

use alloy::app::{idempotency, method_not_allowed, params_json, Actions, AlloyApp, Authority};
use alloy::document::{escape_html_attr, escape_html_text, loader_value, LoaderPayload, Metadata, Shell};
use alloy::error::{AlloyError, Result};
use alloy::router::{Params, Resolution, Route, RouteTable};

// ------------------------------------------------------------------ the app

pub struct App;

impl FerriteApp for App {
    fn run(ctx: AppContext) -> impl std::future::Future<Output = std::io::Result<()>> + Send {
        run(ctx)
    }
}

pub async fn run(ctx: AppContext) -> std::io::Result<()> {
    alloy::app::serve::<App>(ctx).await
}

const BUILD: &str = "yoga-studio-2";
const BODY_SLOT: &str = "<!--__body-->";

const SHELL: &str = concat!(
    "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    // Same-site forms send their real origin under the gateway's
    // no-referrer policy; see the template's comment on this tag.
    "<meta name=\"referrer\" content=\"same-origin\">",
    "<!--__alloy_head-->",
    "<style>",
    ":root{color-scheme:light;--bg:#fbfaf7;--fg:#1c1a18;--muted:#6b645c;--line:#e6e1d9;--accent:#b5452c}",
    "*{box-sizing:border-box}",
    "body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 ui-sans-serif,system-ui,sans-serif}",
    "main{max-width:42rem;margin:0 auto;padding:3rem 1.25rem}",
    "h1{font-size:1.6rem;margin:0 0 .25rem}",
    ".lede{color:var(--muted);margin:0 0 2rem}",
    ".notice{border-left:3px solid var(--accent);padding:.5rem .75rem;margin:0 0 1.5rem;background:#fff}",
    "ul{list-style:none;padding:0;margin:0}",
    "li{border-top:1px solid var(--line);padding:1rem 0}",
    ".when{color:var(--muted)}",
    "form{display:flex;gap:.5rem;margin-top:.5rem}",
    "input{flex:1;min-width:0;padding:.5rem .7rem;border:1px solid var(--line);border-radius:6px;font:inherit}",
    "button{padding:.5rem 1rem;border:0;border-radius:6px;background:var(--accent);color:#fff;font:inherit}",
    "button[disabled]{background:var(--line);color:var(--muted)}",
    "</style>",
    "</head><body><main>",
    "<!--__body-->",
    "</main>",
    "<script id=\"__alloy_data\" type=\"application/json\"></script>",
    "</body></html>"
);

impl AlloyApp for App {
    const BUILD: &'static str = BUILD;
    const SHELL: &'static str = SHELL;

    async fn answer(ctx: &AppContext, req: &IngressRequest) -> Result<IngressReply> {
        dispatch(ctx, req).await
    }

    async fn seed(_ctx: &AppContext) -> Result<()> {
        Ok(())
    }

    async fn admit(_ctx: &AppContext, _req: &IngressRequest, authority: Authority) -> Result<()> {
        match authority {
            Authority::Public => Ok(()),
            _ => Err(AlloyError::internal(
                "this app signs nobody in yet; add sign-in with `ferrite add auth` (see src/auth/SETUP.md)",
            )),
        }
    }
}

// ---------------------------------------------------------------- the model

/// One class on the timetable.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(crate = "ferrite_app::serde")]
pub struct Class {
    pub id: String,
    pub title: String,
    pub starts: String,
    pub capacity: u32,
}

/// The timetable. It lives in code for this tutorial; a real studio would
/// store it and give staff a way to edit it.
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

/// The result of one booking attempt.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Booking {
    /// The booking was admitted. `repeated` is true when this request had
    /// already been admitted and is being answered from its record.
    Confirmed { seat: u32, repeated: bool },
    /// Every space is taken. Nothing was written.
    Full,
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

/// Every class with its booked count, read directly from the bookings APE.
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

fn valid_name(raw: &str) -> Option<String> {
    let name = raw.trim();
    (!name.is_empty() && name.chars().count() <= 80).then(|| name.to_string())
}

// --------------------------------------------------------------- the routes

fn routes() -> Result<RouteTable> {
    let mut table = RouteTable::new();
    table.push(Route::page("index", "/").map_err(AlloyError::internal)?);
    Ok(table)
}

async fn dispatch(ctx: &AppContext, req: &IngressRequest) -> Result<IngressReply> {
    let (bare, query) = match req.path.split_once('?') {
        Some((path, query)) => (path, query),
        None => (req.path.as_str(), ""),
    };

    if let Some(name) = bare.strip_prefix("/__alloy/action/") {
        return alloy::app::dispatch_action(&actions(), ctx, req, name).await;
    }
    if bare.starts_with("/api/") {
        return api(ctx, req, bare).await;
    }

    let table = routes()?;
    let (route, params) = match table.resolve(&req.path, &req.method) {
        Resolution::Matched { route, params } => (route.clone(), params),
        Resolution::MethodNotAllowed { allowed } => return Ok(method_not_allowed(req, &allowed)),
        Resolution::Redirect { location, permanent } => {
            return Err(AlloyError::Redirect { location, permanent })
        }
        Resolution::NotFound => return Err(AlloyError::NotFound),
    };

    let rows = availability(ctx).await?;
    let meta = Metadata::new()
        .title("Yoga studio timetable")
        .description("Book a space in this weekend's classes.")
        .canonical("/");
    let notice = notice_for(query);
    // A per-render key for the booking forms. The clock keeps it unique after a restart.
    let form_key = format!("{}-{}", ctx.now_ms(), req.correlation_id);
    let body = index_body(&rows, notice.as_deref(), &form_key);
    render(req, &route.id, &params, loader_value(&rows)?, &meta, &body)
}

/// The JSON API a customer's assistant (or any client) calls.
async fn api(ctx: &AppContext, req: &IngressRequest, path: &str) -> Result<IngressReply> {
    match (req.method.to_ascii_uppercase().as_str(), path) {
        ("GET", "/api/classes") => {
            let rows = availability(ctx).await?;
            Ok(json(req, 200, &serde_json::json!({ "classes": rows })))
        }
        ("POST", "/api/bookings") => {
            let input: serde_json::Value = serde_json::from_slice(&req.body)
                .ok()
                .filter(|value: &serde_json::Value| value.is_object())
                .ok_or_else(|| AlloyError::bad_request("send a JSON object with class_id and name"))?;
            let class_id = input.get("class_id").and_then(|v| v.as_str()).unwrap_or_default();
            let class = find_class(class_id).ok_or(AlloyError::NotFound)?;
            let name = input
                .get("name")
                .and_then(|v| v.as_str())
                .and_then(valid_name)
                .ok_or_else(|| AlloyError::bad_request("name must be 1 to 80 characters"))?;
            // A caller that sends request_id gets the same retry protection as
            // the MCP tool; otherwise the idempotency-key header is used.
            let key = match input.get("request_id").and_then(|v| v.as_str()) {
                Some(id) if !id.is_empty() => format!("agent:{id}"),
                _ => idempotency(req),
            };
            Ok(booking_reply(req, &class, book(ctx, &class, &name, &key).await?))
        }
        (_, "/api/classes") => Ok(method_not_allowed(req, &["GET".to_string()])),
        (_, "/api/bookings") => Ok(method_not_allowed(req, &["POST".to_string()])),
        _ => Err(AlloyError::NotFound),
    }
}

fn booking_reply(req: &IngressRequest, class: &Class, outcome: Booking) -> IngressReply {
    match outcome {
        Booking::Confirmed { seat, repeated } => json(
            req,
            if repeated { 200 } else { 201 },
            &serde_json::json!({
                "status": "confirmed",
                "class_id": class.id,
                "class": format!("{} ({})", class.title, class.starts),
                "seat": seat,
                "repeated": repeated,
            }),
        ),
        Booking::Full => {
            let body = serde_json::json!({
                "type": "urn:yoga-studio:problem:class-full",
                "title": "Class full",
                "status": 409,
                "detail": format!("{} ({}) has no spaces left.", class.title, class.starts),
                "class_id": class.id,
                "retryable": false,
            });
            let mut reply = IngressReply::new(req.correlation_id.clone(), 409, body.to_string().into_bytes());
            reply.headers.push(("content-type".into(), "application/problem+json".into()));
            reply
        }
    }
}

fn json(req: &IngressRequest, status: u16, body: &serde_json::Value) -> IngressReply {
    let mut reply = IngressReply::new(req.correlation_id.clone(), status, body.to_string().into_bytes());
    reply.headers.push(("content-type".into(), "application/json".into()));
    reply
}

fn notice_for(query: &str) -> Option<String> {
    let (name, value) = query.split('&').find_map(|pair| pair.split_once('='))?;
    let class = find_class(value)?;
    match name {
        "booked" => Some(format!("You're booked into {} ({}).", class.title, class.starts)),
        "full" => Some(format!("{} ({}) is full. Choose another class.", class.title, class.starts)),
        _ => None,
    }
}

fn render(
    req: &IngressRequest,
    route_id: &str,
    params: &Params,
    data: serde_json::Value,
    metadata: &Metadata,
    body: &str,
) -> Result<IngressReply> {
    let payload = LoaderPayload {
        route: route_id.to_string(),
        params: params_json(params),
        data,
        build: BUILD.to_string(),
        epochs: Vec::new(),
    };
    let html = Shell::parse(&SHELL.replace(BODY_SLOT, body), BUILD)?.render(metadata, &payload)?;
    let bytes = if req.method.eq_ignore_ascii_case("HEAD") { Vec::new() } else { html.into_bytes() };
    let mut reply = IngressReply::new(req.correlation_id.clone(), 200, bytes);
    reply.headers.push(("content-type".into(), "text/html; charset=utf-8".into()));
    reply.headers.push(("cache-control".into(), "private, no-cache".into()));
    Ok(reply)
}

/// `form_key` is written into each form, so a double click or a resubmitted
/// form carries the same key and books once.
fn index_body(rows: &[Availability], notice: Option<&str>, form_key: &str) -> String {
    let mut html = String::from(
        "<h1>This weekend's classes</h1><p class=\"lede\">Book a space. Each class has a fixed number of mats.</p>",
    );
    if let Some(text) = notice {
        html.push_str(&format!("<p class=\"notice\" role=\"status\">{}</p>", escape_html_text(text)));
    }
    html.push_str("<ul>");
    for row in rows {
        let class = &row.class;
        html.push_str(&format!(
            "<li><strong>{}</strong> <span class=\"when\">{}</span><br>{} of {} spaces left",
            escape_html_text(&class.title),
            escape_html_text(&class.starts),
            row.spaces_left,
            class.capacity,
        ));
        if row.spaces_left > 0 {
            html.push_str(&format!(
                "<form method=\"post\" action=\"/__alloy/action/book\">\
                 <input type=\"hidden\" name=\"class\" value=\"{}\">\
                 <input type=\"hidden\" name=\"request\" value=\"{}\">\
                 <input name=\"name\" maxlength=\"80\" required placeholder=\"Your name\" aria-label=\"Your name for {}\">\
                 <button type=\"submit\">Book</button></form>",
                escape_html_attr(&class.id),
                escape_html_attr(form_key),
                escape_html_attr(&class.title),
            ));
        } else {
            html.push_str("<form><button type=\"button\" disabled>Full</button></form>");
        }
        html.push_str("</li>");
    }
    html.push_str("</ul>");
    html
}

// -------------------------------------------------------------- the action

fn actions() -> Actions<App> {
    let mut actions = Actions::new();
    actions.public("book", |ctx, req| Box::pin(book_from_form(ctx, req)));
    actions
}

async fn book_from_form(ctx: &AppContext, req: &IngressRequest) -> Result<IngressReply> {
    let class_id = form_field(&req.body, "class").unwrap_or_default();
    let class = find_class(&class_id).ok_or(AlloyError::NotFound)?;
    let name = form_field(&req.body, "name")
        .as_deref()
        .and_then(valid_name)
        .ok_or_else(|| AlloyError::bad_request("name must be 1 to 80 characters"))?;
    let key = match form_field(&req.body, "request") {
        Some(nonce) if !nonce.is_empty() => format!("form:{nonce}"),
        _ => idempotency(req),
    };
    let location = match book(ctx, &class, &name, &key).await? {
        Booking::Confirmed { .. } => format!("/?booked={}", class.id),
        Booking::Full => format!("/?full={}", class.id),
    };
    let mut reply = IngressReply::new(req.correlation_id.clone(), 303, Vec::new());
    reply.headers.push(("location".into(), location));
    Ok(reply)
}

fn form_field(body: &[u8], name: &str) -> Option<String> {
    let text = core::str::from_utf8(body).ok()?;
    text.split('&').find_map(|pair| {
        let (key, value) = pair.split_once('=')?;
        let decode = |raw: &str| alloy::router::percent_decode(&raw.replace('+', " "));
        (decode(key) == name).then(|| decode(value))
    })
}
```

## `tests/booking.rs`

```rust
//! Booking rules for the yoga studio, run against local services.

use ferrite_app_test::{ingress, TestEnv, TestHarness};

/// Starts the real app four times, so four consumers compete for requests.
/// `replies` is the queue the harness collects replies on, as in the
/// template's own tests; `ferrite.json` doesn't declare it.
async fn studio() -> TestEnv {
    let env = TestHarness::new()
        .with_queue("requests")
        .with_queue("replies")
        .with_store("cache")
        .with_store("data")
        .with_ape("tags")
        .with_ape("bookings")
        .build()
        .await;
    for _ in 0..4 {
        env.run_app(|ctx| async move { yoga_studio::run(ctx).await });
    }
    env
}

fn text(reply: &ferrite_app::IngressReply) -> String {
    String::from_utf8_lossy(&reply.body).into_owned()
}

fn book(class_id: &str, key: &str, name: &str) -> ferrite_app::IngressRequest {
    ingress::post_keyed(
        "/api/bookings",
        key,
        format!(r#"{{"class_id":"{class_id}","name":"{name}"}}"#),
    )
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_class_takes_bookings_until_it_is_full() {
    let env = studio().await;

    let page = env.handle(ingress::get("/")).await.expect("a reply");
    assert_eq!(page.status, 200);
    assert!(text(&page).contains("2 of 2 spaces left"), "{}", text(&page));

    let first = env.handle(book("sat-1100-yin", "k1", "Ana")).await.expect("a reply");
    assert_eq!(first.status, 201, "{}", text(&first));

    // The same request again is answered from its record, not booked twice.
    let repeat = env.handle(book("sat-1100-yin", "k1", "Ana")).await.expect("a reply");
    assert_eq!(repeat.status, 200, "{}", text(&repeat));
    assert!(text(&repeat).contains(r#""repeated":true"#));

    let second = env.handle(book("sat-1100-yin", "k2", "Ben")).await.expect("a reply");
    assert_eq!(second.status, 201, "{}", text(&second));

    // The class had two spaces. A third person is refused.
    let third = env.handle(book("sat-1100-yin", "k3", "Chloe")).await.expect("a reply");
    assert_eq!(third.status, 409, "{}", text(&third));
    assert!(text(&third).contains("class-full"));

    // Reusing a key for a different class books that class.
    let other = env.handle(book("sun-1000-beginners", "k1", "Ana")).await.expect("a reply");
    assert_eq!(other.status, 201, "{}", text(&other));

    let classes = env.handle(ingress::get("/api/classes")).await.expect("a reply");
    let listing = text(&classes);
    assert!(listing.contains(r#""id":"sat-1100-yin""#), "{listing}");
    assert!(listing.contains(r#""booked":2"#), "{listing}");

    let page = env.handle(ingress::get("/")).await.expect("a reply");
    assert!(text(&page).contains("0 of 2 spaces left"), "{}", text(&page));
}

/// The deterministic check for overbooking. Two attempts read the same count
/// before either writes, which is exactly what happens when two people book the
/// last space at once. The second write must be refused, and nothing it would
/// have written may land.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_booking_decided_from_a_stale_count_is_refused() {
    let env = studio().await;
    let ctx = env.context();
    let mut bookings = ctx.ape("bookings").expect("the bookings binding");
    let yin = yoga_studio::find_class("sat-1100-yin").expect("the Yin class");

    let first = yoga_studio::read_booking(&mut bookings, &yin, "Ana", "stale-a").await.expect("a read");
    let second = yoga_studio::read_booking(&mut bookings, &yin, "Ben", "stale-b").await.expect("a read");

    let admitted = yoga_studio::commit_booking(&mut bookings, &yin, "Ana", "stale-a", &first).await.expect("a commit");
    assert_eq!(admitted, Some(yoga_studio::Booking::Confirmed { seat: 1, repeated: false }));

    let refused = yoga_studio::commit_booking(&mut bookings, &yin, "Ben", "stale-b", &second).await.expect("a commit");
    assert_eq!(refused, None, "a write decided from a count that has since changed must not land");

    let rows = yoga_studio::availability(&ctx).await.expect("availability");
    let row = rows.iter().find(|row| row.class.id == "sat-1100-yin").expect("the Yin row");
    assert_eq!(row.booked, 1, "only the first booking took a space");

    // Reading again sees the new count, so Ben gets the second space.
    let fresh = yoga_studio::read_booking(&mut bookings, &yin, "Ben", "stale-b").await.expect("a read");
    let second_space = yoga_studio::commit_booking(&mut bookings, &yin, "Ben", "stale-b", &fresh).await.expect("a commit");
    assert_eq!(second_space, Some(yoga_studio::Booking::Confirmed { seat: 2, repeated: false }));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn simultaneous_bookings_never_exceed_capacity() {
    let env = studio().await;
    for (class_id, capacity) in [("sat-0900-vinyasa", 3), ("sat-1100-yin", 2), ("sun-1000-beginners", 4)] {
        // Twelve different people ask for the same class at the same moment.
        let requests = (0..12).map(|i| book(class_id, &format!("{class_id}-r{i}"), &format!("Guest {i}")));
        let statuses: Vec<u16> = env
            .handle_all(requests)
            .await
            .into_iter()
            .map(|reply| reply.expect("a reply").status)
            .collect();
        assert_eq!(statuses.iter().filter(|s| **s == 201).count(), capacity, "{class_id}: {statuses:?}");
        assert_eq!(statuses.iter().filter(|s| **s == 409).count(), 12 - capacity, "{class_id}: {statuses:?}");
    }
    let listing = text(&env.handle(ingress::get("/api/classes")).await.expect("a reply"));
    assert_eq!(listing.matches(r#""spaces_left":0"#).count(), 3, "{listing}");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn simultaneous_retries_of_one_request_book_once() {
    let env = studio().await;
    // The same request, delivered eight times at once, takes one space.
    let requests = (0..8).map(|_| book("sun-1000-beginners", "retry-1", "Ana"));
    let statuses: Vec<u16> = env
        .handle_all(requests)
        .await
        .into_iter()
        .map(|reply| reply.expect("a reply").status)
        .collect();
    assert_eq!(statuses.iter().filter(|s| **s == 201).count(), 1, "{statuses:?}");
    assert_eq!(statuses.iter().filter(|s| **s == 200).count(), 7, "{statuses:?}");
    let page = env.handle(ingress::get("/")).await.expect("a reply");
    assert!(text(&page).contains("3 of 4 spaces left"), "{}", text(&page));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn unknown_classes_and_bad_input_are_refused() {
    let env = studio().await;
    let missing = env.handle(book("nope", "k1", "Ana")).await.expect("a reply");
    assert_eq!(missing.status, 404);
    let nameless = env.handle(book("sat-1100-yin", "k2", "")).await.expect("a reply");
    assert_eq!(nameless.status, 400);
    let not_json = env
        .handle(ingress::post_keyed("/api/bookings", "k3", "class=sat-1100-yin"))
        .await
        .expect("a reply");
    assert_eq!(not_json.status, 400);
}
```

## `tests/smoke.rs`

Lesson 3 adds `.with_ape("bookings")` to the template's smoke test harness so
the home page can read booking counts during test startup. Leave the rest of
the file unchanged from the template.

```rust
    let env = TestHarness::new()
        .with_queue("requests")
        .with_queue("replies")
        .with_store("cache")
        .with_store("data")
        .with_ape("tags")
        .with_ape("bookings")
        .build()
        .await;
```

## Agent-ready additions

After running `ferrite add agent-ready` in
[Let a customer's assistant book a class](/academy/agent-ready/), add the
module declarations and discovery branch to `src/lib.rs` and create
`src/agent.rs`.

If `ferrite add agent-ready` stops before writing and reports four differing
files under `src/crypto/`, the template's vendored crypto package does not
match the version `agent-ready` depends on. Run
`ferrite add agent-ready --force` to replace the vendored copy.

At the top of `src/lib.rs`, beside `pub mod alloy;` and `pub mod crypto;`,
add the module declarations printed by `ferrite add agent-ready` that are not
present yet, along with `agent`:

```rust
pub mod http_change_password;
pub mod http_query;
pub mod agent_ready;
pub mod agent;
```

In `dispatch()`, add the discovery and MCP handler right before the
`/__alloy/action/` branch:

```rust
let surface = agent::surface().served_at(req.verified_host());
if let Some((status, content_type, body, headers)) = agent_ready::well_known::handle_h(
    &surface,
    &req.method,
    &req.path,
    &req.headers,
    &req.body,
    &agent::Pages,
    |name, args| agent::run_tool(ctx, name, args),
)
.await
{
    let mut reply = IngressReply::new(req.correlation_id.clone(), status, body);
    reply.headers.push(("content-type".into(), content_type.into()));
    for (name, value) in headers {
        reply.headers.push((name.into(), value));
    }
    return Ok(reply);
}
```

### `src/agent.rs`

```rust
//! What a customer's assistant can see and call. Added in the course on a
//! customer's assistant with `ferrite add agent-ready`.

use ferrite_app::{serde_json, AppContext};

use crate::agent_ready::mcp_face::ToolOutcome;
use crate::agent_ready::surface::{Operation, Page, Route, RouteKind, Surface};
use crate::agent_ready::well_known::PageSource;
use crate::{availability, book, find_class, Booking};

/// The fallback address the discovery documents name. `dispatch()` replaces
/// it with the host the gateway served the request under
/// (`Surface::served_at`), so this value is used only when the gateway names
/// no host, for example in local tests.
pub const PUBLIC_ORIGIN: &str = "http://localhost:8787";

/// The studio's declared surface. Every discovery document and the MCP tool
/// list are generated from this one value.
pub fn surface() -> Surface {
    Surface {
        name: "yoga-studio".into(),
        owner: "yoga-studio".into(),
        origin: PUBLIC_ORIGIN.into(),
        description: "A yoga studio's weekend timetable. List classes with the spaces left, then book one \
                      space for a named person. A full class refuses the booking; choose another class."
            .into(),
        version: "1.0.0".into(),
        routes: vec![Route {
            prefix: "/api/".into(),
            kind: RouteKind::Api,
            description: "Timetable and bookings.".into(),
            operations: vec![
                Operation {
                    name: "list_classes".into(),
                    method: "GET".into(),
                    path: "/api/classes".into(),
                    description: "List this weekend's classes with start time, capacity, and spaces left. \
                                  Free and safe to retry."
                        .into(),
                    input_schema: None,
                    output_schema: None,
                    read_only: true,
                    idempotent: true,
                    price_micros: 0,
                },
                Operation {
                    name: "book_class".into(),
                    method: "POST".into(),
                    path: "/api/bookings".into(),
                    description: "Book one space in a class for one person. Send the same request_id when \
                                  you retry, so a retry with that request_id doesn't book twice. Refused \
                                  with class-full when no spaces are left."
                        .into(),
                    input_schema: Some(serde_json::json!({
                        "type": "object",
                        "properties": {
                            "class_id": { "type": "string", "description": "An id from list_classes" },
                            "name": { "type": "string", "minLength": 1, "maxLength": 80 },
                            "request_id": { "type": "string", "description": "A unique id you choose for this booking" }
                        },
                        "required": ["class_id", "name", "request_id"],
                        "additionalProperties": false
                    })),
                    output_schema: None,
                    read_only: false,
                    idempotent: true,
                    price_micros: 0,
                },
            ],
        }],
        pages: vec![Page {
            path: "/".into(),
            title: "Weekend timetable".into(),
            summary: "This weekend's classes and how to book them.".into(),
            updated_ms: 0,
            core: true,
        }],
    }
}

/// The Markdown version of the timetable page that assistants can read.
pub struct Pages;

impl PageSource for Pages {
    fn markdown(&self, path: &str) -> Option<String> {
        (path == "/").then(|| {
            "# Weekend timetable\n\nCall `GET /api/classes` for the classes and spaces left. \
             Book with `POST /api/bookings` and a JSON body containing `class_id`, `name`, \
             and `request_id`.\n"
                .to_string()
        })
    }

    fn html(&self, _path: &str) -> Option<String> {
        None
    }
}

/// Runs an MCP tool call through the same functions as the JSON API.
pub async fn run_tool(ctx: &AppContext, name: String, args: serde_json::Value) -> ToolOutcome {
    match name.as_str() {
        "list_classes" => match availability(ctx).await {
            Ok(rows) => ToolOutcome::ok(serde_json::json!({ "classes": rows })),
            Err(_) => ToolOutcome::err(serde_json::json!({ "error": "the timetable could not be read; retry" })),
        },
        "book_class" => {
            let text = |field: &str| args.get(field).and_then(|v| v.as_str()).unwrap_or_default().to_string();
            let (class_id, name, request_id) = (text("class_id"), text("name"), text("request_id"));
            let Some(class) = find_class(&class_id) else {
                return ToolOutcome::err(serde_json::json!({ "error": "unknown class_id; call list_classes" }));
            };
            if name.trim().is_empty() || name.chars().count() > 80 || request_id.is_empty() {
                return ToolOutcome::err(serde_json::json!({ "error": "name (1 to 80 characters) and request_id are required" }));
            }
            match book(ctx, &class, name.trim(), &format!("agent:{request_id}")).await {
                Ok(Booking::Confirmed { seat, repeated }) => ToolOutcome::ok(serde_json::json!({
                    "status": "confirmed", "class_id": class.id, "seat": seat, "repeated": repeated
                })),
                Ok(Booking::Full) => ToolOutcome::err(serde_json::json!({
                    "type": "urn:yoga-studio:problem:class-full",
                    "detail": format!("{} ({}) has no spaces left.", class.title, class.starts),
                    "class_id": class.id,
                    "retryable": false
                })),
                Err(_) => ToolOutcome::err(serde_json::json!({ "error": "the booking could not be completed; retry with the same request_id" })),
            }
        }
        other => ToolOutcome::err(serde_json::json!({ "error": format!("unknown tool {other}") })),
    }
}
```
