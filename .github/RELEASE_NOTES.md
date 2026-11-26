## Cheating Daddy 0.12.0 — Mixed mode, backup keys and a working Gemini API

### Fixed

- **Gemini "404 model no longer available".** Screen analysis used a hardcoded model that Google no longer offers to new users. You now **choose the models yourself**: pick one from the list, type any model ID, or press **Load models available to my key**. Defaults are `gemini-3.8-flash` and `gemini-3.8-live`.
- **"503 high demand" on screen analysis.** A busy model is asked once more, then a backup model answers, and the answer says which one did.
- **Long voice sessions stay connected.** Reconnect attempts no longer add up over a session, and the conversation is resumed on the new connection instead of being retold.
- **Screen analysis over the API** now follows your preset, custom instructions, response language and context folder.
- Errors from Google are shown as a readable sentence, and a failed start keeps you on Home with the reason.
- The Google Search switch now applies in API mode (it was ignored; search is off unless you turn it on).
- Words no longer go missing from Groq answers, and answers are saved to History on newer Live models.

### New

- **Mode tabs** on Home: **CLI**, **API** (formerly BYOK), **Local** and **Mixed**.
- **Mixed mode.** Decide separately who handles voice questions, screen analysis and typed questions, for example voice over fast Gemini Live and screen analysis through your CLI subscription. The CLI also receives what the API answered.
- **Backup API keys.** Add as many Gemini and Groq keys as you like; when one hits its limit or is rejected, the next takes over. They are encrypted like the main keys. Note that Google counts Gemini limits per project, so use keys from different projects.

### Good to know

- Gemini Live sees the whole context folder only while it fits in 24,000 characters (**Full** on Home). For larger folders it gets the list of files; searching them per question works in CLI mode.
- Gemini Live does not see screen analysis answers or, in Mixed mode, what the CLI answered.

### Install

Download **`Cheating-Daddy-Setup.exe`** (installer) or the **portable ZIP** below. On an unsigned build, click **More info → Run anyway** in Windows SmartScreen once.
