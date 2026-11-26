---
kind: lesson
course: ship-an-alloy-app
title: Create the studio app
description: "Generate an Alloy project, run its checks and tests, and locate the code the next two lessons replace."
order: 2
---

The counter in lesson 1 came from the `webapp` template. The yoga studio starts from `alloy`, the template for apps that serve HTML pages and handle form submissions. Scaffold the project, verify that it passes its own checks and tests before making changes, and locate the files and symbols that lessons 3 and 4 replace.

## Generate the project

Run `ferrite new` from your projects directory with `--with-tests` so the scaffold includes the local test harness and smoke test:

```bash
ferrite new alloy yoga-studio --with-tests
cd yoga-studio
```

The output is similar to the following:

```text
created /home/dana/projects/yoga-studio
target: upstream Ferrite Core. ...

next steps:
  cd yoga-studio
  ferrite check          # gate + spec + cargo check (advisory)
  ferrite test           # unit tests in src/ plus tests/smoke.rs against the local harness
                         # the logic you ship needs #[test]s on known answers (src/lib.rs has one to copy)
  ferrite dev            # run locally at http://localhost:8787
  ferrite add auth       # if the app has users: accounts, sign-in and an access list (src/auth/SETUP.md)
  ferrite deploy         # ship to Ferrite Cloud with the account `ferrite account` shows
  ...
```

Skip `ferrite add auth` and `ferrite deploy` for now: the booking page takes public bookings without sign-in, and you deploy in lesson 5 to the account from lesson 1. The generated project also includes `AGENTS.md`, which documents the project's rules for tests, secrets, sign-in, and deployments. If your coding agent helps with the edits in lessons 3 and 4, have it read `AGENTS.md` first.

## Check and test it

Confirm the unmodified starter compiles and passes its tests before replacing the notes model:

```bash
ferrite check
ferrite test
```

`ferrite check` runs the application admission rules, validates `ferrite.json`, and compiles the crate. On the first run, rustup downloads Rust 1.89.0 if it is not installed yet. When the check passes, the output ends with `clean locally` and notes that the local check is advisory. The platform runs its own gate on deploy, and `ferrite check --remote` runs that remote gate without deploying.

`ferrite test` runs the crate's tests against local implementations of Ferrite's queues, stores, and atomic storage. The suite executes three unit tests and two demo tests in `src/lib.rs`, plus one integration test in `tests/smoke.rs`. The demo and smoke test lines read:

```text
test demo_tests::a_cross_origin_action_is_refused_and_a_same_origin_one_is_admitted ... ok
test demo_tests::the_seeded_index_renders_and_the_action_is_replay_safe ... ok
test the_app_boots_and_serves_its_home_page ... ok
```

## Run it locally

Boot the app against in-process local planes and open the starter page in a browser:

```bash
ferrite dev
```

Open `http://localhost:8787/`. If port 8787 is already in use, `ferrite dev` takes the next free port and prints the address it bound; `ferrite dev --port PORT` requires the port you specify or exits. Later lessons assume `localhost:8787`, so substitute your address if it differs.

The starter page lists two notes and includes a form to add another. Submit a note and reload the page: the note persists because the local server keeps its data in `.ferrite/state` between runs. Press Control+C to stop the server.

## Find the parts you change

Three files in the project matter for this course:

- `ferrite.json` is the manifest that declares everything the app can reach. Its `bindings` list every service handle the app receives (here a request queue, two stores, and one atomic storage service) and nothing else. Its `routes` declare the public paths routed to the app, and every public request enters through one of them. Its `compute` setting configures memory and CPU per instance, which drives compute charges; the template's 256 MiB and half a CPU matches the maximum a trial account allows.
- `src/lib.rs` holds the page template, data model, routing, and form action handler.
- `tests/smoke.rs` starts the app against local services and sends requests to it.

Alloy itself is vendored as source under `src/alloy/`, alongside its `sha256-hmac` dependency under `src/crypto/`. Because a Ferrite app names one Cargo dependency (`ferrite-app`), frameworks and packages are copied directly into the source tree so the admission gate inspects them with your code. Leave `src/alloy/` and `src/crypto/` untouched; the next package update overwrites both directories.

Read four pieces in `src/lib.rs` before moving on, because lessons 3 and 4 replace them:

- `SHELL` is the base HTML document that wraps every page. Keep its two markers, `<!--__alloy_head-->` and the empty `__alloy_data` script element, intact.
- `routes()` defines the route table, which initially registers `/` and `/notes/[id]`.
- `dispatch()` matches an incoming request to a route and renders its page.
- `add_note()` handles `POST /__alloy/action/add-note`. It checks whether the submission was already processed, writes the note, and responds with `303 See Other` so reloading the page does not submit the form again.
