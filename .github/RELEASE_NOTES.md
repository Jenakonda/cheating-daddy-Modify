## Cheating Daddy 0.12.2 — Sessions start again after a network drop

### Fixed

- **API and Mixed sessions stopped starting** after the internet connection was lost for a moment (or the computer slept). The attempt to reconnect to Gemini never ended, so every later **Start Session** failed until the app was restarted. A connection that cannot be opened now fails, after 15 seconds at the latest.
- The app says **"Cannot reach Google. Check your internet connection and try again."** instead of failing silently, and the next start works.
- If reconnecting fails during a session, you are told and can start a new one.

If the connection is gone for more than a few seconds, the current session still ends: start it again once you are back online.

Version [0.12.0](https://github.com/Jenakonda/cheating-daddy-Modify/releases/tag/v0.12.0) introduced Mixed mode, backup API keys and Gemini model choice.

### Install

Download **`Cheating-Daddy-Setup.exe`** (installer) or the **portable ZIP** below. On an unsigned build, click **More info → Run anyway** in Windows SmartScreen once.
