## Cheating Daddy 0.10.0 — your presets, a live transcript and control over your data

### What's new

- **Custom presets.** Create your own presets in **AI Context → My presets**: a name, a built-in preset to start from, and your own instructions. They show up next to the built-in ones on Home, in the session bar and in History.
- **Live transcript.** A new **Transcript** panel in the session shows what was heard, split into _You_ and _Speaker_. Press **Ask** next to any line to send it to the AI as a question. Works in CLI and Local AI modes.
- **Subscription status.** A colored dot on the provider pill shows whether Claude or Gemini is working, rate-limited or needs sign-in. Hover it for details such as _Rate limit reached 2 min ago_.
- **Copy and export.** **Copy** the current answer in one click. In History, **Copy** or **Export .md** a whole session as Markdown. Your custom prompt (for example a CV) is never exported.
- **Data and storage.** **Settings → Data and storage** shows how much space history, models, speech engines and logs use, lets you clear each of them, and can delete old history automatically after 7, 30 or 90 days.
- **Continue.** The last Ukrainian label in the session bar (_Далі_) is now **Continue**.

### Fixes

- **Update check.** The _Update available_ button now checks the releases of this fork instead of the original project, so it no longer reports updates that are not for you.
- **Shutdown on Node 22.** Fixed a hang while closing CLI sessions that also made the test suite fail on newer Node versions.

### Under the hood

- New tested modules for presets, update checks, subscription health, data usage and Markdown export; 56 automated tests pass on Node 22 and 24.
- Presets and retention are validated before they are saved.

### Install

Download **`Cheating-Daddy-Setup.exe`** (installer) or the **portable ZIP** below. On an unsigned build, click **More info → Run anyway** in Windows SmartScreen once.
