## Cheating Daddy 0.11.0 — safer, and better at understanding what was said

### What's new

- **Better speech recognition.** On Home, the _Voice Transcription_ section now suggests the **Large v3 Turbo** model when you use a small one with non-English speech, and has an optional **Vocabulary hints** field: list names and terms you expect, and Whisper will spell them correctly more often.
- **Fix a misheard word before asking.** Every transcript line now has **Edit** (puts it in the message box so you can correct it) and **Ask** (sends it as is). Double-click a line to edit it.
- **Smarter handling of garbled speech.** When a phrase makes no sense, the AI now works out which similar-sounding words were meant, answers that question, and ends with one short line stating the question it assumed, so you can spot a wrong guess immediately. Clear questions are unchanged.
- **Encrypted API keys.** Saved keys are now encrypted with your operating system (Windows DPAPI, macOS Keychain, Linux keyring) instead of being stored as plain text. Existing keys are encrypted automatically on first launch, after a check that they can be read back. If the encrypted keys ever cannot be read (for example on another Windows account), the app asks for them again.
- **Help links** now lead to this project's releases, issue tracker and source instead of the original project's website and Discord.

### Security

- Answers from the AI are cleaned (DOMPurify) before they are shown, so a malicious answer or screen text can no longer run code in the app.
- Stricter content security policy: inline scripts are blocked.
- The window can no longer navigate away from the app or open pop-ups; links open in your browser, and only `http` and `https` links are accepted.
- Removed the unused **cloud mode**. It was a client for the original author's paid service, was already hidden in the interface, and logged its access token to the console.

### Under the hood

- `renderer.js` and the Home view were split into focused modules; the screens look exactly as before.
- 76 automated tests plus 6 end-to-end UI checks that start the real app in an isolated profile. CI now runs on every push and pull request.
- Files use LF line endings (`.gitattributes`), and `AGENTS.md` describes the real project (Lit, plain JavaScript) instead of a planned migration.

### Install

Download **`Cheating-Daddy-Setup.exe`** (installer) or the **portable ZIP** below. On an unsigned build, click **More info → Run anyway** in Windows SmartScreen once.
