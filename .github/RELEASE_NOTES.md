## Cheating Daddy 0.9.0 — a calmer, simpler interface

The whole app now shares one dark design system: flat surfaces, a single soft accent, and clear typography. Nothing changes in how sessions, CLI providers or Whisper work.

### What's new

- **New design system.** One palette, spacing and radius scale for every screen; the accent now marks only what is selected or active.
- **Windows-style window controls** (minimize and close on the right) replace the macOS traffic lights, and the sidebar gets a logo mark and cleaner navigation.
- **Home is shorter.** _Start Session_ sits right under the CLI status cards, and the _CLI Provider_, _AI Models & Effort_ and _Voice Transcription_ sections are collapsed by default.
- **Live session bar.** Provider switch, _Далі_ continuation pill, status, timer, _Hide_ and a _Click-through_ badge. The session title no longer overlaps the other elements when click-through is on.
- **Onboarding** is dark and static (no animated background) with a close button and step indicator.
- **Settings, AI Customization, History and Help** share the same cards, controls and thin scrollbars; select boxes no longer truncate their text.
- **Opaque dialogs.** Setup dialogs ignore the background-transparency setting, so the page behind never shows through.
- **Better contrast** for secondary text.

### Under the hood

- Design tokens live in `src/index.html` and the `dark` theme in `src/utils/renderer.js`; other themes keep working and pick up the new accent variables.
- Removed the unused animated button background and its canvases.
- Source formatted with Prettier; all 33 tests pass.

### Install

Download **`Cheating-Daddy-Setup.exe`** (installer) or the **portable ZIP** below. On an unsigned build, click **More info → Run anyway** in Windows SmartScreen once.
