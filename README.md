#  Sir Fills A Lot

An open-source Chrome Extension (Manifest V3) that assists developers and job seekers in filling out job application forms. It respects privacy by keeping all data local and allowing you to bring your own LLM (Local Ollama or API keys).

## Features

- **📄 CV Parsing**: Upload your PDF/Text CV; the extension extracts a structured profile using a "Big" LLM.
- **🔒 Privacy First**: All data (CVs, profiles, keys) is stored in `chrome.storage.local`. No remote backend.
- **🤖 LLM Support**:
  - **Local**: Ollama (e.g., Llama 3).
  - **Cloud**: OpenAI, Groq, Gemini (User API keys required).
- **📝 Job Description Capture**: Right-click to save job descriptions or use the "Pick from page" overlay.
- **⚡ Smart Form Filling**:
  - Heuristic scanning of form fields.
  - Auto-fill from your profile.
  - **Chat Widget**: Ask "What's my notice period?" and it fills the field.
- **✍️ Cover Letter Generation**: Generates tailored cover letters based on your CV + Job Description.
- **🔄 Multi-page Support**: Tracks application sessions across pages.

## Architecture

- **Manifest V3**: Uses Service Worker (`background/index.ts`) for context menus and state.
- **Content Script**: Injects a React-based **Chat Widget** (`content/chatWidget`) into job pages.
- **Storage**: `chrome.storage.local` acts as the single source of truth for Profiles, Preferences, and Sessions.
- **LLM Layer**: `src/llm/providers.ts` abstracts the difference between Ollama, OpenAI, etc.

## Installation (Developer Mode)

1. **Clone & Install**
   ```bash
   git clone <repo-url>
   cd job-helper-extension
   npm install
   ```

2. **Build**
   ```bash
   npm run build
   ```
   This uses Vite + CRXJS to bundle the extension into `dist/`.

3. **Load in Chrome**
   - Open `chrome://extensions`.
   - Enable **Developer mode** (top right).
   - Click **Load unpacked**.
   - Select the `dist` folder.

## Configuration

1. **Open Options**: Click the extension icon -> "Settings" (or right-click icon -> Options).
2. **LLM Setup**:
   - Choose **Local (Ollama)** if you have Ollama running (`ollama run llama3`).
   - Or choose **API Provider** and enter your OpenAI/Groq/Gemini key.
   - Set model names (e.g., Big: `llama3:70b` / `gpt-4`, Small: `llama3:8b` / `gpt-3.5-turbo`).
3. **CV Upload**:
   - Go to "CV & Profile".
   - Upload your CV (Text or PDF).
   - Wait for the LLM to parse it into a structured JSON profile.
4. **Preferences**:
   - Set your desired salary, location, remote preference, etc.

## Usage

1. **Capture Job Description**:
   - Go to a job listing (e.g., LinkedIn, Greenhouse page).
   - Select the job description text -> Right-click -> **Save selection as Job Description**.
   - OR click the extension icon -> **Pick Job Description from Page** -> Click the text block.

2. **Fill Application**:
   - Go to the "Apply" page.
   - Click the floating **Job Helper** button (bottom-right).
   - Click **Scan & Fill**.
   - The extension will try to fill name, email, LinkedIn, etc.
   - Click **Generate Cover Letter** to draft and fill the cover letter field.

3. **Chat Assist**:
   - If a field is missed (e.g., "What is your favorite color?"), open the **Chat** tab.
   - Ask: "My favorite color is Blue".
   - The extension can help answer or you can just type it. (Future: Chat can auto-fill specific fields on command).

## Privacy & Security

- **No Analytics**: We do not track you.
- **Local Storage**: Your CV and keys never leave your browser storage, except to be sent to the LLM provider you configured.
- **You are in control**: You must provide your own API keys.

## Development

- **Dev Server**: `npm run dev` (Vite HMR).
- **Adding Providers**: Edit `src/llm/providers.ts`.
- **Heuristics**: Improve field detection in `src/content/formScanner.ts`.

## Limitations & Roadmap

- **PDF Parsing**: Currently basic text extraction; complex layouts might need better parsing.
- **Form Mapping**: Heuristics are simple regex-based.
- **Roadmap**:
  - Site-specific adapters (Workday, Lever, Greenhouse).
  - Better "Apply with LinkedIn" integration.
  - Resume tailoring (generating a specific PDF for the job).

## License

MIT License.
