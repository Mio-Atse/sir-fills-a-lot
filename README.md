![Sir Fills A Lot banner](_images/banner.png)

Open-source Chrome (MV3) extension that scans job application forms, auto-fills them from your CV, and can generate cover letters. Works offline with local LLMs (Ollama) or with your own API keys for OpenAI/Groq/Gemini. All data stays in `chrome.storage.local` and keys/CV text are encrypted at rest inside the extension.

## Highlights

- CV parsing (PDF/Text) into structured profiles.
- Job description capture via right-click or on-page overlay.
- Heuristic form scanner with wizard for missing fields.
- Cover-letter generation from your profile + captured job description.
- Local mode (Ollama) or API mode with preset model dropdowns and explicit consent for cloud calls.

## How to install

1. Download the latest release zip (containing the `dist/` folder) from GitHub Releases.
2. Unzip it locally.
3. Open Chrome and go to `chrome://extensions`.
4. Enable **Developer mode** (top-right toggle).
5. Click **Load unpacked** and select the unzipped `dist` folder.
6. Pin the extension if you want quick access.

## Developer setup

```bash
git clone https://github.com/Mio-Atse/sir-fills-a-lot
cd sir-fills-a-lot
npm install
npm run build   # outputs dist/
```

Load the generated `dist/` into Chrome via Load unpacked (steps above). For hot reload during development, run `npm run dev`.

## Configure the extension

1. Click the extension icon → **Settings** (or right-click → Options).
2. LLM mode:
   - **Local (Ollama)**: pick a preset command (e.g., `ollama run llama3:8b`). Small-model selection is ignored; big model is used for all calls.
   - **API Provider**: choose OpenAI, Groq, or Gemini; enter your API key; pick models from the dropdowns or supply a custom model; check the consent box to allow data to be sent to the provider.
3. Upload your CV (PDF/Text) to create a profile; the raw text and base64 are encrypted at rest in storage.
4. Set preferences (locations, remote, salary, etc.).

## Using it

1. Capture a job description:
   - Right-click selected text → **Save selection as Job Description**, or
   - In the popup, click **Pick Job Description** and click the description block on the page, or
   - Paste text into the popup’s **Paste Job Description** flow.
2. Open a job application form; the floating widget appears.
3. Click **Scan & Auto-Fill**. The wizard walks you through any missing fields.
4. Click **Generate Cover Letter** once a profile and job description exist.
5. Use the **Chat** tab for quick answers and to fill remaining text boxes.

## Data & permissions

- Data is stored locally in `chrome.storage.local`; CV text and API keys are encrypted at rest. Your data only leaves the browser if you enable API mode and consent to cloud LLM calls.
- The content script currently runs on all pages to detect job forms; permissions remain broad and should be narrowed in a future update.
- Bring your own API keys; none are bundled.

## Contributing

![Sir Fills A Lot UI preview](_images/design-new.png)

- Read [CONTRIBUTING.md](CONTRIBUTING.md) and follow the [Code of Conduct](CODE_OF_CONDUCT.md).
- CI: run `npm run build` before pushing. A simple GitHub Actions workflow can run `npm ci` and `npm run build` on pull requests.

## License

MIT License. See [LICENSE](LICENSE).
