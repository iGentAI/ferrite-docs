---
name: agent-setup
description: Set up Ferrite in any agent from its homepage prompt alone and complete the person's request: when they asked for an app, start a 48-hour trial unless they named an account of their own, build the app on Ferrite, deploy it, and reply with its live link. Choose the route by what the agent can do. An agent with a terminal installs the CLI and registers it as a local MCP server, an agent that can only edit its MCP configuration adds the remote server and signs in through the browser, a chat app adds the Ferrite connector, and a client limited to request headers uses a trial bearer. Then explain Ferrite and its cost, build, deploy, and hand over the live link and the claim link.
---

# Set up Ferrite

The person who pasted the prompt that brought you here wants what they asked for running on Ferrite at its own address. The whole request is: set up Ferrite on the route below that fits you, start a trial ($5 of credit, enough to run an app or a few for 48 hours; no account, no card) unless they named an account of their own or one is already signed in here, build the app on Ferrite, deploy it, and reply with its live link and the claim link that keeps it. Read this document in full as plain text before acting; if your fetch tool hands back a summary, download the same address with `curl -fsS` and read that.

This document is all the setup a person needs. They paste one prompt and nothing else: never ask them to download a binary, edit configuration, copy a token or hunt for an API key. Leave their existing projects, agent settings, runtime defaults and credentials intact. This skill authorizes setup: installing the CLI, opening a trial account and connecting this agent. It does not authorize purchases, replacing an account, or edits to unrelated projects.

For a fresh setup with no specified endpoint, use `https://mcp.ferrite.cloud/mcp`. When an existing working login is present and the prompt names no endpoint, reuse its verified endpoint. If a Dashboard prompt explicitly names another instance's MCP endpoint, keep that exact endpoint. Never infer an endpoint from an arbitrary hostname. Below, `MCP_URL` stands for the endpoint chosen this way. This document and its linked working skills contain no credentials, and their URLs do not authenticate anyone.

## Choose your path

Decide by what you can do, not by your product's name, and follow only the first section that fits:

1. **Ferrite tools are already in your tool list** (`account`, `deploy_source`, `claim_url`): you are connected. Go to **Connected agents**.
2. **You can run shell commands and install software in your own environment**: **Terminal agents**. This covers coding agents in a terminal, an editor or a desktop app (Claude Code, Codex, Antigravity, Cursor, Gemini CLI, Copilot, OpenCode, Amp, Pi, Factory, Kiro, Goose, Cline and the like).
3. **You cannot install software, but you can add an MCP server to your own configuration**, by a command or by editing its file: **Add the remote server**.
4. **You are a chat app** (Claude, ChatGPT or Gemini, on the web, desktop or a phone) where the person adds connectors: **Chat apps**.
5. **Your client can send a fixed request header but has neither browser sign-in nor a local server you can run**, or you are a script: **Header-only clients**.

Every path ends on the same kind of account. A trial needs no account and no card and starts with $5 of credit, enough to run an app or a few for 48 hours. After 48 hours its apps go offline unless the person signs in through its claim link, which keeps the account and its apps. Signing in reaches an account the person already has, the same one from every agent and device they connect.

### Choose the account

Start a trial unless the person points to an account of their own. Choose by what they asked for, once per conversation:

- **They asked you to build something new** and said nothing about an account: start a trial without asking, tell them you did, and add one sentence saying you can connect their existing Ferrite account instead if they have one.
- **They asked about something that already exists** (their apps, a build or deploy, visitors, usage, their balance or their account), said they already have an account, or the prompt names one: connect to their account. When they did not say they have one, ask once, "Start fresh with a 48-hour trial, or connect to your existing Ferrite account?", recommending the second, and wait for the answer.
- **They asked only for setup**: ask the same question, recommending a trial unless they mentioned an account.

A login already stored on this machine (**Use the account already on this machine**) and a connection that is already signed in answer the question themselves: use that account. On a connector or a remote server the person makes the choice on Ferrite's connect page, so tell them which of its two buttons fits.

## Tell the person first

Before building, give the person one short, plain summary of what Ferrite is and what their app would cost. Give it once per conversation. Giving it does not pause setup: state the summary and finish setup in the same turn. If they asked you to build and the account is a trial, carry on unless they object; on a trial account a build request authorizes that first deploy once you have reported its cost. On a durable account, wait for approval of the monthly estimate before the first deploy of a new app. If they asked only for setup, finish setup and ask what to build. If they asked only a question, answer it.

### What Ferrite is

Ferrite runs applications written by AI agents, and every application is safe by construction. The app is safe Rust (no `unsafe` code, one dependency) that the platform checks, builds and runs from source. It reaches only the stores, queues, routes, secrets and outbound hosts its `ferrite.json` declares, with no filesystem, environment, process or open network access, and every outbound call passes through the platform gateway. `ferrite.json` is the short list of everything the app can touch, so you can read it to the person instead of asking them to read Rust. An account spends only what it holds, so no app can run up a bill.

Every app is ready for AI assistants from its first deploy. Each operation is declared once and served both as web pages for people and as machine-readable surfaces (Markdown, OpenAPI and MCP) for the assistants its customers send, under the same permissions, capacity checks and rules.

### What it costs

Ferrite draws from a prepaid balance at metered rates and quotes every deploy before you ship. There is no plan fee and no seat fee. A small always-on app costs about $8 a month. Refusals and failed builds are free. When a balance reaches zero, apps stop, stay stored for 30 days, and are then deleted with their data.

On Ferrite Cloud a trial starts with $5 of credit, enough to run an app or a few for 48 hours, with no account and no card. Signing in keeps the account and its apps. Once the app is specified, run `ferrite cost --instances 1` in its directory (MCP: `estimate_cost`) and report the deploy fee and the monthly estimate. The platform's quote is the price.

## Terminal agents

### Check the machine

Identify the current agent and operating system, and configure only that agent unless the person asks for others. Check `FERRITE_CLI_BIN` first, then `command -v ferrite`, then `~/.local/bin/ferrite`. This probe succeeds even when Ferrite is absent:

```bash
F="${FERRITE_CLI_BIN:-$(command -v ferrite 2>/dev/null || true)}"
[ -z "$F" ] && [ -x "$HOME/.local/bin/ferrite" ] && F="$HOME/.local/bin/ferrite"
echo "ferrite: ${F:-not installed}"
```

If a binary is present, run `--version`, `mcp-serve --help` and `account --json` with that exact executable. Check, without printing values, whether `FERRITE_TOKEN` or `FERRITE_MCP_TOKEN` is exported; if either is, ask the person to unset it before continuing so it cannot mask the stored login. Never print a credential file, token, cookie or environment secret. `account --json` returns account and endpoint metadata only.

### Install the CLI when needed

The installer supports Apple Silicon macOS, Linux x86-64 and Linux ARM64 (glibc 2.34 or newer). It downloads a native binary, verifies the release manifest's `SHA256SUMS.sig` signature and the binary's SHA-256 digest, and installs without root or Node.js. On any other platform, follow **Add the remote server** instead.

```bash
ferrite_setup_dir=$(mktemp -d "${TMPDIR:-/tmp}/ferrite-setup.XXXXXX")
curl -fsSL https://downloads.ferrite.cloud/install.sh \
  -o "$ferrite_setup_dir/install.sh"
sh "$ferrite_setup_dir/install.sh" --no-agents
```

Invoke `~/.local/bin/ferrite` directly if the shell cannot resolve `ferrite`. Keep an explicitly set `FERRITE_CLI_BIN` authoritative. Never replace an existing incompatible executable without consent, and never edit shell startup files or global runtime defaults. Verify `--version` and `mcp-serve --help` after installing. If the download or the binary is blocked (a managed laptop, a locked-down container), follow **Add the remote server** instead.

### Use the account already on this machine

The CLI stores one login, bound to one endpoint and one account, in `~/.config/ferrite/credentials.toml` (or the path in `FERRITE_CONFIG`). `mcp-serve` reads the same file, so every agent on this machine that runs `ferrite mcp-serve` acts as the same account. When `ferrite account --json` succeeds at the expected endpoint, use that account: it is how a person's second agent on the same computer joins the first. If the prompt names an account, compare its exact ID with `accountId`.

Never replace a working login, switch endpoints, or create a second account to get around a mismatch. An expired or refused login does not mean the account is gone: report it, keep the file, and offer `ferrite login --sign-in`. A trial login that was kept or moved on the Dashboard switches itself: `ferrite account --json` then answers for the new account and reports `trialFollow`. If `account --json` returns `LOGIN_UNKNOWN_TO_PLATFORM`, the platform does not know the stored login (usually one issued by an earlier installation); offer the commands in the reply's `next` field, and run one only with the person's agreement, because each replaces the stored login.

### Start a trial

With no stored login, when **Choose the account** says to start a trial:

```bash
ferrite login --endpoint MCP_URL --ephemeral --json
ferrite account --json
```

Trial account IDs start with `eph-`. The trial deploys at once, and after 48 hours its apps go offline unless the person signs in through its claim link (**Hand the account to its owner**). Report the reply's `deployNote`. Then add one sentence: if they already have a Ferrite account, you can connect to it instead with `ferrite login --sign-in`.

### Join an existing account

When **Choose the account** says to connect to their account, or a Dashboard prompt names one that this machine does not hold, run:

```bash
ferrite login --sign-in
```

It opens the browser to Ferrite's sign-in. The person continues with Google or GitHub, picks the account, and clicks **Allow**; the CLI saves a named login for this computer and prints the account. When the CLI cannot open a browser it prints the address to open. It signs in to Ferrite Cloud unless this computer's login or `--endpoint MCP_URL` names another installation. Confirm the account with `ferrite account --json`.

If it answers `LOGIN_SIGN_IN_REPLACE_REQUIRED`, this computer already holds a working login for another account (the reply names it in `storedAccountId`) and nothing was changed. Tell the person which account this computer uses now and ask whether it should switch to the account they sign in to. Only after they confirm, run `ferrite login --sign-in --replace`; the old login is kept as a backup file.

If this machine already deployed apps on a trial, give the person the trial's claim link instead (`ferrite claim --link` prints it): after signing in there they move those apps into the existing account, or keep the trial as an account of their own.

A machine without any browser (CI, a remote container) uses a named token instead: the owner creates one in Dashboard **Settings > API tokens** and copies its credentials file; save those bytes to a private file with mode `600`, run `ferrite login --credentials-file PATH` (it verifies endpoint and account before saving), and delete the temporary file. Never ask for a token in chat.

Do not run `ferrite agent connect` or `ferrite agent recover`; Ferrite Core does not serve them, and `agent connect` exits with `AGENT_SETUP_UNSUPPORTED_PLATFORM`.

Work that must have a durable account with no person to claim it (an operator script, a shared fixture) can create one by name: `ferrite login --endpoint MCP_URL --id ACCOUNT_NAME --json`.

### Connect this agent

Register one MCP server named `ferrite` that runs the installed CLI with `mcp-serve`, and install one skill file. That is the whole integration: the adapter is built into the CLI, reads the CLI's stored login, needs no Node.js, and writes no token into agent configuration. Do not register the plugin's Node bridge or a remote Ferrite server beside it; both would reach the same account and duplicate every tool. If the installer already registered a working `ferrite` entry, keep it. Inspect any existing `ferrite` entry before changing it, and leave unrelated entries alone.

Replace `FERRITE_EXECUTABLE` with the absolute path of the verified binary and use the **Local server** column of **Client commands** for the current agent, at user (global) scope rather than in a project file. Read the saved entry back through the client (`claude mcp get ferrite`, `codex mcp get ferrite`, `agy mcp list`, `opencode mcp list`, `pi mcp list`, or the client's equivalent).

If this agent has no way to add an MCP server at all, skip registration: the CLI does everything the server does (`ferrite deploy`, `ferrite cost`, `ferrite claim --link`), and the working skill uses it.

Save `https://docs.ferrite.cloud/agent-setup/ferrite/SKILL.md` as `ferrite/SKILL.md` in the agent's user-level skills directory. Most agents read `~/.agents/skills/` (Codex, Cursor, Gemini CLI, GitHub Copilot CLI, Zed, Junie, OpenCode, Cline, Roo Code, Kilo Code, Goose, Amp, Pi, Factory, Warp, Qwen Code, Crush and Devin). These use their own: Claude Code `~/.claude/skills/`, Antigravity `~/.gemini/config/skills/`, Kiro `~/.kiro/skills/`, VS Code Copilot `~/.copilot/skills/`, Continue `~/.continue/skills/`, Augment `~/.augment/skills/`. Install one copy, and none when a working Ferrite plugin or skill is already visible to the agent (Cursor and OpenCode also read `~/.claude/skills/`). An agent without skills reads the same file from its URL when it builds.

### Verify

Confirm all five before reporting setup complete:

1. The CLI prints its version and supports `mcp-serve`.
2. `ferrite account --json` succeeds against the intended endpoint and account.
3. The agent's configuration points at the verified executable with `mcp-serve`, or keeps an existing verified Ferrite integration.
4. The Ferrite working skill is installed, or an existing plugin provides it.
5. If this session can call the new MCP server, list its tools and run one read-only account call; otherwise say MCP is configured and takes effect after a restart.

Report the version, the account, and the MCP and skill status without secrets. Then build with the working skill.

## Add the remote server

Use this path when you can edit your own MCP configuration but cannot install the CLI. Add Ferrite's remote server, `MCP_URL` (Streamable HTTP), under the name `ferrite` with no headers and no token, using the **Remote server** column of **Client commands** at user scope. Inspect any existing `ferrite` entry first and keep a working one. The client discovers Ferrite's sign-in from the server itself (OAuth, with dynamic registration and client metadata documents both offered) and opens the browser, either on the first account call or through the command in the **Sign in** column.

Signing in opens Ferrite's connect page in the browser. Tell the person what they will see and which button to choose:

- **Try Ferrite without an account** starts the trial: $5 of credit, enough to run an app or a few for 48 hours, with no account and no card. Recommend it when **Choose the account** says to start a trial.
- **Sign in to your Ferrite account** is for a person who already has one: Google or GitHub, pick the account, **Allow**.

Some clients (Antigravity, for one) show a code after the browser step for the person to paste back into the client; say so when yours does. When the client needs a restart to load the new server, say so in one sentence and continue once the Ferrite tools appear. Then follow **Connected agents**.

## Client commands

`FERRITE_EXECUTABLE` is the verified binary's absolute path; `MCP_URL` is the endpoint from the top of this document. Where a row names a file, merge the entry into that object and keep everything else in the file. "Shape A" is the common entry: local `"ferrite": {"command": "FERRITE_EXECUTABLE", "args": ["mcp-serve"]}`, remote `"ferrite": {"url": "MCP_URL"}`, under `mcpServers`.

| Client | Local server | Remote server | Sign in (remote) |
| --- | --- | --- | --- |
| Claude Code | `claude mcp add --scope user --transport stdio ferrite -- FERRITE_EXECUTABLE mcp-serve` | `claude mcp add --transport http --scope user ferrite MCP_URL` | `/mcp`, or `claude mcp login ferrite` |
| Codex CLI, app and IDE extension | `codex mcp add ferrite -- FERRITE_EXECUTABLE mcp-serve` | `codex mcp add ferrite --url MCP_URL` | `codex mcp login ferrite`; **Authenticate** in the app |
| Antigravity app, IDE and `agy` | `agy mcp add ferrite FERRITE_EXECUTABLE mcp-serve` | `agy mcp add ferrite MCP_URL` | `/mcp` in `agy`; **MCP Servers > Authenticate** in the app |
| Gemini CLI | `gemini mcp add -s user ferrite FERRITE_EXECUTABLE mcp-serve` | `gemini mcp add -s user --transport http ferrite MCP_URL` | `/mcp auth ferrite`, or the first account call |
| Cursor editor and CLI | shape A in `~/.cursor/mcp.json` | shape A there | Cursor prompts; `agent mcp login ferrite` in its CLI |
| VS Code with Copilot | `code --add-mcp '{"name":"ferrite","type":"stdio","command":"FERRITE_EXECUTABLE","args":["mcp-serve"]}'` | `code --add-mcp '{"name":"ferrite","type":"http","url":"MCP_URL"}'` | the browser opens on first use |
| GitHub Copilot CLI | `copilot mcp add ferrite -- FERRITE_EXECUTABLE mcp-serve` | `copilot mcp add --transport http ferrite MCP_URL` | automatic; `/mcp auth ferrite` |
| Kiro IDE and CLI | `kiro-cli mcp add --name ferrite --command FERRITE_EXECUTABLE --args mcp-serve --scope global`, or shape A in `~/.kiro/settings/mcp.json` | `kiro-cli mcp add --name ferrite --url MCP_URL --scope global`, or shape A there | the browser opens; `/mcp auth` in the CLI |
| Devin Desktop (formerly Windsurf) | `devin mcp add ferrite -- FERRITE_EXECUTABLE mcp-serve` | `devin mcp add ferrite --url MCP_URL` | `devin mcp login ferrite`, or **Authenticate** |
| Zed | `"ferrite": {"command": "FERRITE_EXECUTABLE", "args": ["mcp-serve"]}` under `context_servers` in Zed's settings | `"ferrite": {"url": "MCP_URL"}` there | Zed prompts |
| JetBrains Junie | shape A in `~/.junie/mcp/mcp.json` | shape A there | `/mcp`, then **Authorize** |
| JetBrains AI Assistant | shape A in **Settings > Tools > AI Assistant > Model Context Protocol (MCP)** | **Header-only clients** | |
| OpenCode | `opencode mcp add ferrite -- FERRITE_EXECUTABLE mcp-serve`, or `"ferrite": {"type": "local", "command": ["FERRITE_EXECUTABLE", "mcp-serve"]}` under `mcp` in `~/.config/opencode/opencode.jsonc` (or `.json`) | `opencode mcp add ferrite --url MCP_URL`, or `"ferrite": {"type": "remote", "url": "MCP_URL"}` there | `opencode mcp auth ferrite` |
| Cline | `cline mcp add ferrite --yes -- FERRITE_EXECUTABLE mcp-serve` | `cline mcp add ferrite MCP_URL --transport http --yes` | **Authenticate** in its MCP view |
| Roo Code | shape A in **Edit Global MCP** | **Header-only clients**, with `"type": "streamable-http"` | |
| Kilo Code | `kilo mcp add ferrite -- FERRITE_EXECUTABLE mcp-serve` | `kilo mcp add ferrite --url MCP_URL` | `kilo mcp auth ferrite` |
| Goose | under `extensions` in `~/.config/goose/config.yaml`: `ferrite: {name: ferrite, type: stdio, cmd: FERRITE_EXECUTABLE, args: [mcp-serve], enabled: true}` | `ferrite: {name: ferrite, type: streamable_http, uri: MCP_URL, enabled: true}` there | the browser opens on connect |
| Continue | in the `mcpServers` list of `~/.continue/config.yaml`: `{name: ferrite, command: FERRITE_EXECUTABLE, args: [mcp-serve]}` | `{name: ferrite, type: streamable-http, url: MCP_URL}` there | **Authenticate** under Tools |
| Amp | `amp mcp add ferrite -- FERRITE_EXECUTABLE mcp-serve` | `amp mcp add ferrite MCP_URL` | when Amp starts |
| Pi | `pi mcp add ferrite -- FERRITE_EXECUTABLE mcp-serve` | `pi mcp add ferrite --url MCP_URL` | `pi mcp login ferrite` |
| Factory Droid | `droid mcp add ferrite "FERRITE_EXECUTABLE mcp-serve"` | `droid mcp add --type http ferrite MCP_URL` | `/mcp` |
| Warp | shape A in `~/.warp/.mcp.json`, or **Settings > Agents > MCP servers** | shape A there | the browser opens on first start |
| Qwen Code | `qwen mcp add --scope user ferrite FERRITE_EXECUTABLE mcp-serve` | `qwen mcp add --scope user --transport http ferrite MCP_URL` | `/mcp`, then **Auth** |
| Augment | `auggie mcp add ferrite --command FERRITE_EXECUTABLE --args mcp-serve` | `auggie mcp add ferrite --transport http --url MCP_URL` | **Authenticate** |
| Crush | `"ferrite": {"type": "stdio", "command": "FERRITE_EXECUTABLE", "args": ["mcp-serve"]}` under `mcp` in `~/.config/crush/crush.json` | `"ferrite": {"type": "http", "url": "MCP_URL", "oauth": true}` there | its sign-in dialog |

Without its CLI on `PATH`, Codex (CLI, app and IDE extension share it) takes `[mcp_servers.ferrite]` in `~/.codex/config.toml` with `command = "FERRITE_EXECUTABLE"` and `args = ["mcp-serve"]`, or `url = "MCP_URL"`; Antigravity takes shape A in `~/.gemini/config/mcp_config.json` with `serverUrl` in place of `url`; Gemini CLI takes shape A in `~/.gemini/settings.json` with `httpUrl`; Devin Desktop takes shape A in `~/.config/devin/mcp_config.json`, and an older Windsurf `~/.codeium/windsurf/mcp_config.json` with `serverUrl`. In Cline set `"type": "streamableHttp"` on a remote entry it did not write itself.

**Any other client.** Prefer its own `mcp add` command (read its `--help` first) over editing its file, and write to user scope. A local server is the client's stdio, command or local type with command `FERRITE_EXECUTABLE` and arguments `["mcp-serve"]`, no environment and no headers; most clients take shape A. A remote server is its Streamable HTTP type (often called `http`, `streamable-http`, `remote`, `url`, `serverUrl` or `httpUrl`; not SSE) with the URL `MCP_URL` and no headers; the client finds sign-in from the server and opens the browser itself or through its auth command. When it offers no sign-in at all, use **Header-only clients**.

## Chat apps

A chat app cannot run a terminal or edit its own configuration, so the Ferrite connector is how it reaches Ferrite. The person adds Ferrite from the app's connector directory, or adds a custom connector with the URL `https://mcp.ferrite.cloud/mcp`. Ask the app to connect Ferrite for this conversation; when it offers a **Connect** button, the person presses it. Otherwise give them the one step for their app, then have them come back to this conversation:

- **Claude** (web, desktop and mobile share one list): **Customize > Connectors > Add custom connector**, named `Ferrite`, with the URL `https://mcp.ferrite.cloud/mcp` and authentication set to **Sign in when needed**.
- **ChatGPT**, on the web: **Plugins**, then **+** and **Add custom MCP server**, named `Ferrite`, with the URL `https://mcp.ferrite.cloud/mcp` and OAuth authentication, then install it. Where the app still shows the older layout: **Settings > Apps > Advanced settings**, switch on **Developer mode**, then **Create app** with the same name, URL and OAuth.
- **Gemini**: on gemini.google.com in a browser, **Settings > Connected Apps**, then under **Custom apps** choose **Add a custom app**, enter the URL `https://mcp.ferrite.cloud/mcp` and click **Next**. It is added on the web and then works in the phone app too.

Either way Ferrite's connect page opens. They choose **Try Ferrite without an account**, or **Sign in to your Ferrite account** if they have one. Continue with **Connected agents** as soon as the tools appear. Adding the connector is the only thing they ever do by hand.

## Header-only clients

Use this path for a client that can send a fixed request header but cannot sign in through the browser and cannot run the CLI (Roo Code on a machine where installing is blocked, for example), and for scripts and CI. Where browser sign-in works, use it: Cursor, for one, drops configured headers for a server that offers sign-in.

1. Add `MCP_URL` with no header, and call `provision_ephemeral` once with no arguments (or send that one call as a `POST` to `MCP_URL`). It returns the trial account, its `token` and its `claim_token`.
2. Keep both tokens private: never print them or put them in chat, a URL, a project file or a repository. Write the token into the client's own user-level configuration as the header `Authorization: Bearer <token>`, and keep the claim token in a private file (mode `600`).
3. Reconnect, call `account` to confirm the `eph-` account, and continue with **Connected agents**.

The claim link of a trial opened this way attaches an owner but keeps the 48-hour deadline, so keep its apps by moving them with `claim` and the claim token (the guide linked under **Hand the account to its owner**).

## Connected agents

Call `account` first. On a connection that has not signed in yet, that call makes the client open Ferrite's connect page (the two choices under **Add the remote server**); once it answers, it names the account this connection acts as. Never call `provision` or `provision_ephemeral` on a connection that signs in through the browser, and do not install the CLI. For a small web app, use the [page-app starter](https://docs.ferrite.cloud/agent-setup/ferrite/starters/page-app.md) for the browser page, OpenAPI and MCP routes. Clients limited to Ferrite tools can read the store-backed form example with `read_docs {"doc":"page-app-starter"}`. Report the cost with `estimate_cost` first, using the same spec and planned instance count. Submit `deploy_source` once and follow `build_status {build_id, wait_s: 50}` until it reports `deployed`, `rejected`, `failed` or `stuck`. If the tool omits `wait_s`, poll every five seconds. On success open the returned host and verify the app. On failure report its reason.

A browser sign-in makes this connection one entry under **Connected agents** in the person's Dashboard. That is where they move it to another account they own or revoke it. To start a fresh trial or sign in to a different account, they disconnect Ferrite in the client (or revoke it there) and connect again, choosing on the connect page. Tell the person this when they ask to switch accounts, start over or disconnect; never provision, claim or edit configuration to do it. After a move, a keep or a revoke, the next call can be refused once while the client renews its sign-in: call `account` again, and if the client shows a sign-in button instead, the person presses it.

## Hand the account to its owner

When the person mentions an existing Ferrite account, wants to keep the work, wants to see it in the Dashboard, or wants Ferrite on another device, call the MCP tool `owner_status` (`remote_owner_status` through `mcp-serve`). If the account has no owner, call the MCP tool `claim_url` (`remote_claim_url`) and give them the link; on a trial, give it unprompted with the live link when you deliver the first app. It works on every trial, including one started from a connector. These are MCP tools, not CLI subcommands: in a terminal, `ferrite claim --link` prints the same link, and says so instead when an owner is already linked.

The link opens the Dashboard. After Google or GitHub sign-in, on a trial started by the CLI or a connector, it offers two choices:

- **Keep this as my account**: the trial becomes a permanent account of their own, with the same apps, URLs and data, and the 48-hour deadline is gone. Its ID changes from `eph-…` to a readable one. Every connected agent and every CLI login of the trial follows to it automatically.
- **Move it into** an account they already own: the apps move into that account with their URLs and data, and every connected agent and CLI login follows, so your next call already acts as their account.

The link works once and expires after 24 hours; share it only with the person, and never extract its `web_token` or build a link from a claim secret. After they finish, call `account` and `owner_status` (or run `ferrite account --json`, which moves this computer's login to the new account by itself) and use the new account ID from then on. Through `mcp-serve`, one call may answer `TRIAL_LOGIN_FOLLOWED`; repeat it. If an owner is already linked, every other agent joins by signing in: `ferrite login --sign-in` on a computer with the CLI, or **Sign in to your Ferrite account** on the connect page of any connector or remote server.

A client that holds a trial's claim token and cannot hand a link to a person moves its apps with the `claim` tool instead: follow `https://docs.ferrite.cloud/developers/mcp-only-operations/#keep-a-trial-app-past-its-48-hours`.

Check **Usage & billing** for the account balance. Trials cannot receive additional credit. After claiming a trial or signing in to a durable account, check whether **Usage & billing** offers checkout. If purchasing is disabled on Ferrite Cloud, the owner can [contact Ferrite support](https://docs.ferrite.cloud/kb/guide/get-help-from-the-ferrite-team/) with the durable account ID.

## Finish the job

If the person asked for an app, build it now with the working skill (or the Ferrite server's guidance on a connection): use public sample data, run the checks, report the cost, deploy under the rule in **Tell the person first**, and open the returned URL before reporting success. Finish with the live link and, on a trial, the claim link. Never deploy a throwaway app only to test the installation.

Whenever asked what an app costs, run `ferrite cost` in its directory or call `estimate_cost` with its manifest, and read `ferrite statement` or `account_statement` for the balance; never infer the balance from the starting credit. Through `mcp-serve` these tools are `remote_estimate_cost` and `remote_account_statement`.

## Private instances

A private Ferrite instance may sit behind a sign-in gate: a Ferrite URL redirects to `login.`, or the MCP endpoint answers `401` before any account exists. When `FERRITE_PREVIEW_TOKEN` is set, read the URL with the token header, keep `-q` first, never pass `-L`, and continue only on HTTP `200`:

```bash
printf 'X-Ferrite-Preview: %s\n' "$FERRITE_PREVIEW_TOKEN" | curl -q -fsS -w '\nHTTP status %{http_code}\n' -H @- URL
```

If it is unset, ask the person for that instance's preview token without asking for it in chat, and never print it. The CLI and its installer read `FERRITE_PREVIEW_TOKEN` themselves.
