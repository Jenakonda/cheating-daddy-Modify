# Cheating Daddy (CLI & Offline Whisper Edition)

Real-time transparent desktop assistant for interviews, meetings, presentations, and exams. Captures screen on demand, transcribes system audio and/or microphone locally via `whisper.cpp` (with Vulkan GPU acceleration on Windows), and answers using your own **Claude Pro** / **Google AI Pro** CLI subscriptions, API keys (BYOK), or Local AI.

> [!NOTE]
> Use an up-to-date Windows, macOS, or Linux environment. On Windows, window content protection keeps the overlay hidden from screen shares and screenshots.

---

## Quick Start

### Option 1: Windows Installer / Portable ZIP (Recommended — No Node.js or Git needed)

1. Download **`Cheating-Daddy-Setup.exe`** (installer) or **`Cheating Daddy-win32-x64-*.zip`** (portable) from the repository's [**Releases**](https://github.com/Jenakonda/cheating-daddy-Modify/releases) page.
2. Run the installer (or extract the ZIP and run `Cheating Daddy.exe`).
    - _First-launch Windows SmartScreen note:_ for unsigned builds, click **More info** -> **Run anyway** once.
3. On Home, under **CLI Availability**, click **`Install & Sign In`** on the **Gemini (`agy`)** or **Claude CLI** card to install the CLI and sign in with your Google / Anthropic subscription in one click (no manual console commands needed).

### Option 2: Run from Source (Developers)

1. **Install prerequisites**: [Node.js](https://nodejs.org/) (v20+) and at least one CLI subscription if using CLI mode:
    - **Google Antigravity CLI `agy` (Google AI Pro / Ultra)**:
        - Windows (PowerShell): `irm https://antigravity.google/cli/install.ps1 | iex`
        - Windows (CMD): `curl -fsSL https://antigravity.google/cli/install.cmd -o install.cmd && install.cmd && del install.cmd`
        - macOS / Linux: `curl -fsSL https://antigravity.google/cli/install.sh | bash`
        - Verify with `agy --version`, then run `agy` once to sign in with Google.
    - **Claude Code CLI (Claude Pro / Max)**:
        - Windows (PowerShell): `irm https://claude.ai/install.ps1 | iex`
        - Or via npm: `npm install -g @anthropic-ai/claude-code`, then run `claude` once to sign in.
2. **Clone & install dependencies**:
    ```bash
    git clone https://github.com/Jenakonda/cheating-daddy-Modify.git
    cd cheating-daddy-Modify
    npm install
    ```
    > **Note for npm 11+ (`allowScripts`):** if launching fails with `Electron binary not found`, run `node node_modules/electron/install.js` once to download `electron.exe`.
3. **Launch or package**:
    - **Console-less launch (recommended)**: `npm start` (or double-click `Start-Silent.vbs` on Windows)
    - **Development launch with terminal logs**: `npm run start:dev`
    - **Build Windows installer + portable ZIP locally**: `npm run make`
    - **Run automated tests**: `npm test`

---

## AI Provider Modes

- **CLI Mode (Default — Subscription OAuth, no API keys needed)**:
    - Supports **Claude Code CLI** (`sonnet`, `opus`, `haiku`, `fable`, custom model ID + `--effort` strength) and **Google Antigravity CLI `agy`** (all live models & reasoning tiers, with **Refresh models** sync).
    - Supports **Auto-fallback** on rate limits/errors and one-click live provider switching during an active session (context preserved).
- **BYOK Mode**: Gemini Live API and Groq keys.
- **Local AI Mode**: Local GGUF LLM via `llama.cpp` + local `whisper.cpp` (completely offline).

---

## Local Offline Voice Transcription (Whisper)

- Automatically downloads verified `whisper.cpp` binaries and selected quantized models (`small-q5_1`, `base-q5_1`, `large-v3-turbo-q5_0`, etc.) on first launch.
- Automatically enables **Vulkan GPU acceleration** on supported Windows GPUs with safe fallback to CPU (`-ng`) if GPU initialization fails.
- **Audio Input Modes**:
    - `System Audio Only` — captures remote speakers (Zoom/Meet/browser output).
    - `Microphone Only` — captures your own voice.
    - `Both Microphone & System Audio` — supports **Silent microphone context**: quietly buffers what you say without overwriting the screen, attaches it when the other speaker replies, or generates 1–2 continuation sentences when you click **`Далі`** during a session.
- **Speech Language**: `Auto-detect`, Ukrainian (`uk-UA`), English, Polish, German, Russian, etc.

---

## Context Folder (Presentations, Docs, Exam Guides)

Drop files into the **Context Folder** right from **Home** or **AI Context**:

- **Supported formats**: `.pptx` (ordered slides + speaker notes), `.odp`, `.pdf` (per-page text extraction with Cyrillic/Unicode support), `.docx` (paragraphs + tables), `.odt`, `.rtf`, `.xlsx`, `.html`, `.md`, `.txt`, `.csv`, `.json`, `.yaml`, and source code files.
- **Hybrid context delivery**:
    - **Full mode** (`<= 24,000` chars): all files are loaded cleanly into the session system context (cached across turns, available to voice, text, and `Analyze Screen`).
    - **Smart search mode** (`> 24,000` chars): injects a compact catalog into the prompt and attaches the top 5 matching chunks (`[Context: file · Slide/Page]`) per question via fast local search.
- Controls: toggle **Context Folder**, **`+ Add Files`**, **`Open Folder`**, **`Choose Folder`**, **`Refresh`**, **`Default`**.

---

## Presets, Response Language & Shortcuts

- Choose a **Preset** (`Job Interview`, `Exam Assistant`, `Business Meeting`, `Sales Call`, `Presentation`, `Negotiation`) and optional **Preferred Response Language** (`Auto`, `Українська`, `English`, etc.) directly on **Home**.

### Keyboard Shortcuts

- **`Ctrl/Cmd + Enter`** — Start session (on Home) or **Analyze Screen** screenshot (in live session)
- **`Ctrl/Cmd + M`** — Toggle click-through mode
- **`Ctrl/Cmd + \`** — Show / Hide window
- **`Ctrl/Cmd + Shift + Up / Down`** — Scroll response (`PageUp` / `PageDown` also works when focused; all shortcuts can be customized in **Settings**)
- **`Ctrl/Alt + Arrow Keys`** — Move overlay window
- **`Ctrl/Cmd + [ / ]`** — Previous / Next response
- **`Ctrl/Cmd + Shift + E`** — Emergency erase & quit

---

## Privacy & Local Data

All personal preferences, credentials, session history, downloaded binaries/models, and the default **Context Folder** are stored strictly outside the repository on your own machine:

- **Windows**: `%APPDATA%\cheating-daddy-config`
- **macOS**: `~/Library/Application Support/cheating-daddy-config`
- **Linux**: `~/.config/cheating-daddy-config`

Nothing personal is ever committed to this repository.
