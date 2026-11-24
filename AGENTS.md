# Repo Guidelines

This repository is a fork of [`cheating-daddy`](https://github.com/sohzm/cheating-daddy).
It is an Electron app that captures screen and audio and answers with an AI of the user's
choice (Claude / Gemini CLI, bring-your-own API keys, or fully local models).
The code is plain JavaScript (no TypeScript, React or bundler) and is packaged with Electron Forge.

## Getting started

```
npm install
npm start          # console-less launch
npm run start:dev  # launch with terminal logs
npm test           # automated tests (node:test)
```

## Project layout

- `src/index.js`, `src/storage.js`, `src/utils/` – main process and shared logic (CommonJS).
  Pure logic (presets, update check, data usage, export, health tracking) lives in small modules here
  without Electron imports, so it can be tested in Node.
- `src/renderer/` – renderer entry (`index.js`, loaded as a classic script by `index.html`) and its modules:
  storage bridge, themes, provider start-up, screen/audio capture, UI helpers. It exposes `window.cheatingDaddy`.
- `src/components/` – UI built with [Lit](https://lit.dev) web components (ES modules). Large views keep
  option lists and styles in a `main/` folder next to the view.
- `src/assets/` – vendored libraries (Lit, marked, highlight.js, DOMPurify) and icons.
- `test/` – tests. `docs/screenshots/` – README images.

## Style

- Format only the files you touched: `npx --yes prettier@3 --write <files>`. Do not run Prettier on the whole repo,
  it reformats untouched code. Settings are in `.prettierrc` (4 spaces, width 150, single quotes, semicolons).
- Files use LF line endings (`.gitattributes`).
- There is no linter; `npm run lint` only prints a message.

## Code standards

- **No tracking.** The app must not send telemetry or analytics. Outbound requests are limited to: GitHub (release and
  update check), Hugging Face and GitHub releases (model and binary downloads, SHA-256 pinned), the AI provider the user
  chose, and `127.0.0.1` for the local servers.
- **Untrusted HTML.** AI answers and screen text are untrusted. Never assign them to `innerHTML` directly; use
  `cheatingDaddy.sanitizeHtml` or `escapeHtml`. The CSP forbids inline scripts, do not add them.
- **Secure IPC.** Validate and sanitize every parameter that crosses from the renderer to the main process
  (see `isSafeExternalUrl` for an example). The window currently runs with `nodeIntegration` on and `contextIsolation` off;
  moving to context isolation needs a preload bridge and a bundler and is future work.
- **Non-blocking audio.** Heavy processing stays out of the UI thread.
- **Tests.** Every new piece of logic needs tests in `test/*.test.js`. They must pass on Node 22 and 24.
  For UI changes, run the app and check the affected screens.
- **Privacy by design.** Keep processing local when possible, give users control over retention and deletion,
  document what is stored and where, and store only what is needed.

## Tests, CI and releases

- CI (`.github/workflows/ci.yml`) runs the tests on every push to `master` and every pull request.
- Pushing a `v*` tag runs `.github/workflows/release.yml`: it runs the tests, builds the Windows installer and portable ZIP,
  and publishes a GitHub release using `.github/RELEASE_NOTES.md`.
- To release: bump the version in `package.json`, rewrite `.github/RELEASE_NOTES.md`, update the README if needed, commit,
  then tag and push.

## Commits and upstream PRs

- Keep commit messages short and descriptive (`feat:`, `fix:`, `docs:`, `chore:`).
- Do not add `Co-Authored-By` or "generated with" trailers.
- Pull requests from <https://github.com/sohzm/cheating-daddy> are cherry-picked here. Inspect the diff, then run the app
  locally and the tests after merging.

## Audio principles

- Resample all audio to 16 kHz before sending it to whisper.cpp.
- Capture microphone and system audio on separate channels.
- Pre-filter silence with voice activity detection (an energy-based VAD is implemented in `whisper-stt.js`).
- Keep sample fidelity, avoid blocking the UI, and handle audio device failures gracefully.

## Direction

Done: local transcription with whisper.cpp, dual-stream capture, energy-based VAD, CLI / BYOK / local providers,
custom presets, live transcript, data retention controls, redesigned interface.

Planned: context isolation with a preload bridge, speaker separation inside a single stream (tinydiarize is English-only
today), a neural VAD if the energy-based one proves too coarse, removal of the old Gemini/Groq limit counters in `storage.js`,
more tests around capture and IPC.

Decided against: a rewrite in Rust, and a migration to TypeScript, React or shadcn. The project stays on Lit and plain JavaScript.
