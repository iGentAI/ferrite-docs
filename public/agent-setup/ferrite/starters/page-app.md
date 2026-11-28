---
name: ferrite-page-app-starter
description: A verified one-file Ferrite web app (a live poll as shipped) with a store-backed form post, a polished shadcn-style theme, and the same operations served to AI assistants as Markdown, OpenAPI and MCP. Adapt it for small web apps such as polls, RSVPs, sign-up sheets, guestbooks, scoreboards and simple dashboards.
---

# Page-app starter

A complete Ferrite app in one Rust file that has been deployed and verified
as is. Adapt it instead of scaffolding Alloy or reading package source.

It is ready for AI assistants from its first deploy: besides the page for
people, it serves `/llms.txt` (Markdown), `/openapi.json` with JSON at
`/api/...`, and an MCP server at `/mcp`, all for the same operations under the
same rules.

With the CLI:

```sh
ferrite new hello <name>
cd <name>
# Replace src/main.rs with the file below, replace src/lib.rs with the
# two-line stub below, and replace ferrite.json with the spec below
# (set "name" and "artifact_key" to <name>).
ferrite check --json
ferrite test
ferrite cost --instances 1
ferrite deploy
```

Without a shell, call `estimate_cost` with the spec and your intended
instance count. Pass the same spec, `src/main.rs`, and a `Cargo.toml` naming
only `ferrite-app = { path = "../ferrite-app" }` to `deploy_source` once.
Follow the build with `build_status`.

Adapt the constants, `handle` (routes) and `render` (the page), and change the
operations in `llms`, `openapi`, `tools` and `call_tool` to match, so an
assistant can do through `/api/...` and `/mcp` exactly what a person can do on
the page. Keep the serve loop, `reply`, `html`, `json_reply`, `escape`, the
MCP handler and the CSS tokens. Escape visitor text with `escape`. After
deploying, open `/llms.txt` on the live host as well as `/`.

This app uses one store. Add another only for a separate access boundary,
durability requirement, or measured capacity need. Prefix keys for different
record types in the same store. Set worker CPU and memory explicitly, and
preview again if you change the replica count.

## src/lib.rs

```rust
#![forbid(unsafe_code)]
//! The whole app is in src/main.rs.
```

## ferrite.json

Keep both workload declarations when copying the app. For a small store, keep `hot_set_gib: 0`. This selects the platform cache default (64 MiB on this release). A value of 1 requests 1 GiB of RAM per store copy, even if the store contains almost no data. Increase it only when measured use justifies a larger cache, and set `volume_mib` large enough to hold it.

```json
{ "services": [
    { "name": "requests", "primitive": "queue",
      "workload": { "read_qps": 50, "write_qps": 50, "record_size_kb": 1, "keying": "PerKey", "hot_set_gib": 1 } },
    { "name": "data", "primitive": "store",
      "workload": { "read_qps": 50, "write_qps": 20, "record_size_kb": 1, "keying": "PerKey", "hot_set_gib": 0 } }
  ],
  "applications": [{
    "name": "page-app",
    "artifact_key": "apps/page-app@v1",
    "artifact_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
    "bindings": [
      { "handle": "requests", "kind": "queue", "service": "requests" },
      { "handle": "data", "kind": "store", "service": "data" }
    ],
    "routes": [ { "prefix": "/", "binding": "requests", "kind": "api" } ],
    "compute": { "memory_mb": 256, "cpu_percent": 50 }
  }]
}
```

## src/main.rs

```rust
#![forbid(unsafe_code)]
//! The page-app starter: a complete, deployed-and-verified Ferrite app that
//! serves one polished page, records form posts in the app's store, and is
//! ready for AI assistants: the same two operations (read the results, cast a
//! vote) are served as Markdown at `/llms.txt`, as an OpenAPI document at
//! `/openapi.json` with JSON at `/api/...`, and as MCP tools at `/mcp`. It is a
//! live poll as shipped; adapt it to the request (an RSVP list, a sign-up
//! sheet, a guestbook, a scoreboard, a dashboard) by changing the constants,
//! `handle`, `render` and the operations in `llms`, `openapi`, `tools` and
//! `call_tool`, so people and assistants keep seeing the same app.
//!
//! `GET /` renders the page; `POST /vote` with `choice=<id>` records a vote
//! (once per request, by its idempotency key) and redirects back to `/`.
//! Store API used here: `get(key)`, `add(key, n)` (atomic counter),
//! `put_if_version(key, value, None)` (create-if-absent). Escape any text a
//! visitor typed with `escape` before putting it in HTML.

use std::time::Duration;

use ferrite_app::client::StoreClusterClient;
use ferrite_app::serde_json::{self, json, Value};
use ferrite_app::{app_main, rt, AppContext, FerriteApp, IngressReply, IngressRequest};

const TITLE: &str = "Team poll";
const QUESTION: &str = "What should Claude build next?";
const OPTIONS: [(&str, &str); 4] = [
    ("game", "A browser game"),
    ("devtool", "A developer tool"),
    ("agent", "A personal AI agent"),
    ("art", "A generative art studio"),
];

struct App;

impl FerriteApp for App {
    fn run(ctx: AppContext) -> impl std::future::Future<Output = std::io::Result<()>> + Send {
        serve(ctx)
    }
}

async fn serve(ctx: AppContext) -> std::io::Result<()> {
    let mut requests = ctx.queue("requests")?;
    let mut votes = ctx.store("data")?;
    loop {
        let lease = match requests.poll_wait(1_000).await {
            Ok(Some(l)) => l,
            Ok(None) => continue,
            Err(_) => {
                rt::time::sleep(Duration::from_millis(200)).await;
                continue;
            }
        };
        let Ok(req) = serde_json::from_slice::<IngressRequest>(&lease.payload) else {
            let _ = requests.ack(lease.token).await;
            continue;
        };
        let reply = match handle(&mut votes, &req).await {
            Ok(r) => r,
            Err(_) => html(&req, 503, "<p>Store unavailable, try again.</p>".into()),
        };
        if let Ok(mut out) = ctx.reply_to_queue(&req.reply_to).await {
            if let Ok(payload) = serde_json::to_vec(&reply) {
                let _ = out.publish(&payload).await;
            }
        }
        let _ = requests.ack(lease.token).await;
    }
}

async fn handle(votes: &mut StoreClusterClient, req: &IngressRequest) -> std::io::Result<IngressReply> {
    let path = req.path.split('?').next().unwrap_or("/");
    match (req.method.as_str(), path) {
        ("GET", "/") => Ok(html(req, 200, render(&counts(votes).await?))),
        ("POST", "/vote") => {
            let Some(id) = parse_choice(&req.body) else {
                return Ok(html(req, 400, "<p>Unknown option. <a href=\"/\">Back</a></p>".into()));
            };
            record(votes, id, &req.idempotency_key).await?;
            let mut r = IngressReply::to(req, 303, b"<meta http-equiv=\"refresh\" content=\"0;url=/\">".to_vec());
            r.headers.push(("location".into(), "/".into()));
            r.headers.push(("content-type".into(), "text/html; charset=utf-8".into()));
            Ok(r)
        }
        // The same operations for AI assistants: Markdown, OpenAPI with JSON, and MCP.
        ("GET", "/llms.txt") => Ok(reply(req, 200, "text/markdown; charset=utf-8", llms().into_bytes())),
        ("GET", "/openapi.json") => Ok(json_reply(req, 200, &openapi())),
        ("GET", "/api/results") => Ok(json_reply(req, 200, &results(&counts(votes).await?))),
        ("POST", "/api/vote") => {
            let choice = serde_json::from_slice::<Value>(&req.body).ok().and_then(|v| known(v["choice"].as_str()?));
            let Some(id) = choice else {
                return Ok(json_reply(req, 400, &json!({ "error": "choice must be one of the option ids", "options": option_ids() })));
            };
            record(votes, id, &req.idempotency_key).await?;
            Ok(json_reply(req, 200, &results(&counts(votes).await?)))
        }
        ("POST", "/mcp") => mcp(votes, req).await,
        ("GET", "/mcp") => Ok(reply(req, 405, "text/plain; charset=utf-8", b"POST JSON-RPC to /mcp".to_vec())),
        _ => Ok(html(req, 404, "<p>Not found. <a href=\"/\">Back</a></p>".into())),
    }
}

/// The vote count for each option, in `OPTIONS` order.
async fn counts(votes: &mut StoreClusterClient) -> std::io::Result<[u64; 4]> {
    let mut counts = [0u64; 4];
    for (i, (id, _)) in OPTIONS.iter().enumerate() {
        if let Some(v) = votes.get(format!("count/{id}").as_bytes()).await? {
            counts[i] = String::from_utf8_lossy(&v).parse::<i64>().unwrap_or(0).max(0) as u64;
        }
    }
    Ok(counts)
}

/// Counts one vote for `id`, once per request: delivery is at least once, so
/// the request's idempotency key is recorded first.
async fn record(votes: &mut StoreClusterClient, id: &str, idempotency_key: &str) -> std::io::Result<()> {
    let seen = format!("seen/{idempotency_key}");
    if votes.put_if_version(seen.as_bytes(), b"1", None).await?.is_ok() {
        votes.add(format!("count/{id}").as_bytes(), 1).await?;
    }
    Ok(())
}

fn results(counts: &[u64; 4]) -> Value {
    let options: Vec<Value> = OPTIONS
        .iter()
        .zip(counts)
        .map(|((id, label), votes)| json!({ "id": id, "label": label, "votes": votes }))
        .collect();
    json!({ "question": QUESTION, "options": options, "total": counts.iter().sum::<u64>() })
}

fn option_ids() -> Vec<&'static str> {
    OPTIONS.iter().map(|(id, _)| *id).collect()
}

fn known(choice: &str) -> Option<&'static str> {
    OPTIONS.iter().map(|(id, _)| *id).find(|id| *id == choice)
}

/// The app for an assistant that reads Markdown: what it is and how to use it.
fn llms() -> String {
    let mut options = String::new();
    for (id, label) in OPTIONS {
        options.push_str(&format!("- `{id}`: {label}\n"));
    }
    format!(
        "# {TITLE}\n\n> {QUESTION} A live poll: anyone can vote once per request and see the results.\n\n\
## Options\n\n{options}\n## Operations\n\n\
- Read the results: `GET /api/results` returns the question, each option's votes and the total.\n\
- Vote: `POST /api/vote` with the JSON body `{{\"choice\": \"<option id>\"}}` returns the new results.\n\n\
## For AI assistants\n\n\
- [OpenAPI](/openapi.json): the same operations as an OpenAPI 3.1 document.\n\
- MCP: Streamable HTTP at `/mcp`, with the tools `get_results` and `vote`.\n\
- [The page](/): the poll for people.\n"
    )
}

fn openapi() -> Value {
    json!({
        "openapi": "3.1.0",
        "info": { "title": TITLE, "version": "1", "description": QUESTION },
        "paths": {
            "/api/results": { "get": {
                "operationId": "get_results",
                "summary": "Read the poll's question, each option's votes and the total",
                "responses": { "200": { "description": "The results", "content": { "application/json": {} } } }
            } },
            "/api/vote": { "post": {
                "operationId": "vote",
                "summary": "Cast one vote",
                "requestBody": { "required": true, "content": { "application/json": { "schema": {
                    "type": "object", "required": ["choice"],
                    "properties": { "choice": { "type": "string", "enum": option_ids() } }
                } } } },
                "responses": {
                    "200": { "description": "The results after the vote", "content": { "application/json": {} } },
                    "400": { "description": "Unknown option" }
                }
            } }
        }
    })
}

/// The MCP tools: the same operations as `/api/results` and `/api/vote`.
fn tools() -> Value {
    json!([
        { "name": "get_results", "description": format!("Read the results of the poll \"{QUESTION}\""),
          "inputSchema": { "type": "object", "properties": {} },
          "annotations": { "readOnlyHint": true } },
        { "name": "vote", "description": format!("Cast one vote in the poll \"{QUESTION}\""),
          "inputSchema": { "type": "object", "required": ["choice"],
            "properties": { "choice": { "type": "string", "enum": option_ids() } } } }
    ])
}

/// A minimal MCP server (Streamable HTTP, JSON responses): `initialize`,
/// `ping`, `tools/list` and `tools/call`. Notifications are accepted with 202.
async fn mcp(votes: &mut StoreClusterClient, req: &IngressRequest) -> std::io::Result<IngressReply> {
    let Ok(message) = serde_json::from_slice::<Value>(&req.body) else {
        return Ok(json_reply(req, 400, &rpc_error(Value::Null, -32700, "Parse error")));
    };
    let Some(id) = message.get("id").cloned() else {
        return Ok(IngressReply::to(req, 202, Vec::new()));
    };
    let params = &message["params"];
    let result = match message["method"].as_str().unwrap_or("") {
        "initialize" => json!({
            "protocolVersion": params["protocolVersion"].as_str().unwrap_or("2025-06-18"),
            "capabilities": { "tools": {} },
            "serverInfo": { "name": TITLE, "version": "1" },
            "instructions": QUESTION,
        }),
        "ping" => json!({}),
        "tools/list" => json!({ "tools": tools() }),
        "tools/call" => match call_tool(votes, params, &req.idempotency_key).await? {
            Ok(value) => json!({ "content": [{ "type": "text", "text": value.to_string() }], "structuredContent": value }),
            Err(why) => json!({ "content": [{ "type": "text", "text": why }], "isError": true }),
        },
        _ => return Ok(json_reply(req, 200, &rpc_error(id, -32601, "Method not found"))),
    };
    Ok(json_reply(req, 200, &json!({ "jsonrpc": "2.0", "id": id, "result": result })))
}

async fn call_tool(
    votes: &mut StoreClusterClient,
    params: &Value,
    idempotency_key: &str,
) -> std::io::Result<Result<Value, String>> {
    match params["name"].as_str().unwrap_or("") {
        "get_results" => Ok(Ok(results(&counts(votes).await?))),
        "vote" => {
            let Some(id) = params["arguments"]["choice"].as_str().and_then(known) else {
                return Ok(Err(format!("choice must be one of: {}", option_ids().join(", "))));
            };
            record(votes, id, idempotency_key).await?;
            Ok(Ok(results(&counts(votes).await?)))
        }
        other => Ok(Err(format!("unknown tool {other}"))),
    }
}

fn rpc_error(id: Value, code: i64, message: &str) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } })
}

/// HTML-escapes visitor-supplied text.
fn escape(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;").replace('\'', "&#39;")
}

fn reply(req: &IngressRequest, status: u16, content_type: &str, body: Vec<u8>) -> IngressReply {
    let mut r = IngressReply::to(req, status, body);
    r.headers.push(("content-type".into(), content_type.into()));
    r.headers.push(("cache-control".into(), "no-store".into()));
    r
}

fn html(req: &IngressRequest, status: u16, body: String) -> IngressReply {
    reply(req, status, "text/html; charset=utf-8", body.into_bytes())
}

fn json_reply(req: &IngressRequest, status: u16, value: &Value) -> IngressReply {
    reply(req, status, "application/json", value.to_string().into_bytes())
}

/// The option id from a urlencoded form body (`choice=<id>`), if it names a known option.
fn parse_choice(body: &[u8]) -> Option<&'static str> {
    let body = std::str::from_utf8(body).ok()?;
    known(body.split('&').find_map(|kv| kv.strip_prefix("choice="))?)
}

/// Whole-number percentage of `n` out of `total`, rounded half up; 0 when nobody has voted.
fn percent(n: u64, total: u64) -> u64 {
    if total == 0 { 0 } else { (n * 200 + total) / (total * 2) }
}

fn render(counts: &[u64; 4]) -> String {
    let total: u64 = counts.iter().sum();
    let mut buttons = String::new();
    let mut bars = String::new();
    for (i, (id, label)) in OPTIONS.iter().enumerate() {
        let p = percent(counts[i], total);
        buttons.push_str(&format!(
            "<button class=\"btn\" type=\"submit\" name=\"choice\" value=\"{id}\">{label}</button>"
        ));
        bars.push_str(&format!(
            "<div class=\"row\"><div class=\"lbl\"><span>{label}</span><span class=\"muted\">{c} &middot; {p}%</span></div>\
             <div class=\"track\"><div class=\"fill\" style=\"width:{p}%\"></div></div></div>",
            c = counts[i]
        ));
    }
    let noun = if total == 1 { "vote" } else { "votes" };
    format!(
        "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">\
<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>{QUESTION}</title>\
<link rel=\"alternate\" type=\"text/markdown\" href=\"/llms.txt\"><style>{CSS}</style></head><body><main>\
<section class=\"card\"><h1>{QUESTION}</h1><p class=\"muted\">Pick one. Results update as votes come in.</p>\
<form method=\"post\" action=\"/vote\" class=\"grid\">{buttons}</form></section>\
<section class=\"card\"><div class=\"head\"><h2>Results</h2><span class=\"badge\">{total} {noun}</span></div>{bars}</section>\
</main></body></html>"
    )
}

const CSS: &str = "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');\
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#fafafa;color:#09090b;\
font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}\
main{max-width:36rem;margin:0 auto;padding:3rem 1rem;display:grid;gap:1.5rem}\
.card{background:#fff;border:1px solid #e4e4e7;border-radius:.75rem;padding:1.5rem;box-shadow:0 1px 3px 0 rgb(0 0 0/.1),0 1px 2px -1px rgb(0 0 0/.1)}\
h1{font-size:1.5rem;font-weight:600;letter-spacing:-.025em;margin:0 0 .375rem}h2{font-size:1.125rem;font-weight:600;margin:0}\
.muted{color:#71717a;font-size:.875rem;margin:0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-top:1.25rem}\
.btn{font:inherit;font-size:.875rem;font-weight:500;height:2.75rem;padding:0 1rem;border-radius:.5rem;border:1px solid #e4e4e7;\
background:#fff;color:#09090b;cursor:pointer;box-shadow:0 1px 2px 0 rgb(0 0 0/.05);transition:background .15s}\
.btn:hover{background:#f4f4f5}.btn:focus-visible{outline:2px solid #a1a1aa;outline-offset:2px}\
.head{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem}\
.badge{font-size:.75rem;font-weight:600;padding:.125rem .625rem;border-radius:9999px;background:#18181b;color:#fafafa}\
.row{margin-top:.875rem}.lbl{display:flex;justify-content:space-between;font-size:.875rem;font-weight:500;margin-bottom:.375rem}\
.track{height:.5rem;border-radius:9999px;background:#f4f4f5;overflow:hidden}.fill{height:100%;background:#18181b;border-radius:9999px}\
@media(max-width:480px){.grid{grid-template-columns:1fr}}";

fn main() {
    app_main::<App>()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn percentages() {
        assert_eq!(percent(0, 0), 0);
        assert_eq!(percent(1, 3), 33);
        assert_eq!(percent(2, 3), 67);
        assert_eq!(percent(1, 8), 13);
        assert_eq!(percent(5, 5), 100);
    }

    #[test]
    fn escapes() {
        assert_eq!(escape("<a href=\"x\">&'"), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
    }

    #[test]
    fn choices() {
        assert_eq!(parse_choice(b"choice=agent"), Some("agent"));
        assert_eq!(parse_choice(b"x=1&choice=art"), Some("art"));
        assert_eq!(parse_choice(b"choice=nope"), None);
        assert_eq!(parse_choice(b""), None);
    }

    #[test]
    fn assistants_see_the_same_operations() {
        let names: Vec<_> = tools().as_array().unwrap().iter().map(|t| t["name"].as_str().unwrap().to_string()).collect();
        assert_eq!(names, ["get_results", "vote"]);
        let spec = openapi();
        assert_eq!(spec["paths"]["/api/results"]["get"]["operationId"], "get_results");
        assert_eq!(spec["paths"]["/api/vote"]["post"]["operationId"], "vote");
        let text = llms();
        for (id, _) in OPTIONS {
            assert!(text.contains(&format!("`{id}`")), "{text}");
        }
        assert!(text.contains("/api/vote") && text.contains("/openapi.json") && text.contains("/mcp"), "{text}");
    }

    #[test]
    fn results_add_up() {
        let r = results(&[1, 2, 0, 3]);
        assert_eq!(r["total"], 6);
        assert_eq!(r["options"][1]["id"], "devtool");
        assert_eq!(r["options"][1]["votes"], 2);
    }
}
```
