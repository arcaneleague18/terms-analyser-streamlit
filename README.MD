# ⚖️ Terms & Conditions Analyzer

## Overview
The **Terms & Conditions Analyzer** is an AI-powered application designed to help users quickly understand long and complex legal documents. By leveraging Large Language Models (LLMs), this tool bridges the gap between complex legal jargon and everyday users, mitigating the risks associated with blind agreements.


## Features
- **Flexible Document Ingestion:** Provide a URL to scrape the terms directly from a website, or paste the raw text into the app.
- **Document Summarization:** Get a clear, concise summary of the terms within seconds.
- **Risk Extraction:** Automatically identifies and highlights the most offensive, unfair, or highly risky clauses hidden in the fine print as bullet points.
- **Interactive Chat:** An integrated chatbot interface allows you to ask follow-up questions about the document and get immediate answers.
- **Local Chrome Extension:** A browser extension companion that runs **100% offline and keyless** using Chrome's built-in Gemini Nano model.

## Technologies Used
- **Web App:** Streamlit (Frontend/UI) & Langchain (LLM Orchestration)
- **Chrome Extension:** Manifest V3, Javascript Scripting API
- **Local AI:** Google Gemini Nano (Prompt API / `window.ai`)
- **Cloud Models:** Qwen/Qwen3-Coder-Next (via OpenRouter API in Streamlit app)
- **Environment Management:** Python `dotenv` for handling API keys in Streamlit

## Installation

### Option A: Streamlit Web App Setup
1. **Clone the repository and enter directory:**
   ```bash
   git clone <repository_url>
   cd terms-analyser-streamlit
   ```
2. **Install dependencies:**
   This project uses `uv` for environment and package management. Sync the environment:
   ```bash
   uv sync
   ```
3. **Set up environment variables:**
   Create a `.env` file in the root directory and add your OpenRouter API Token:
   ```env
   OPENAI_API_KEY=your_openrouter_api_token_here
   ```

### Option B: Chrome Extension Setup (Offline, Keyless)
1. **Prerequisites (Chrome 128+ recommended)**:
   - Go to `chrome://flags/#prompt-api-for-gemini-nano` -> Set to **Enabled**.
   - Go to `chrome://flags/#optimization-guide-on-device-model` -> Set to **Enabled BypassPerfRequirement**.
   - Relaunch Google Chrome.
   - Go to `chrome://components` -> Find **Optimization Guide On-Device Model** and click **Check for update** to download the model.
2. **Load Extension**:
   - Open `chrome://extensions/` and enable **Developer Mode** (top-right).
   - Click **Load unpacked** (top-left) and select the `chrome-extension` directory inside this repository.

## Usage

### Using the Streamlit App
1. Run the app:
   ```bash
   uv run streamlit run app.py
   ```
2. Open `http://localhost:8501` in your browser.
3. Paste a T&C URL or raw text and click **Analyze Document**.
4. Read the summary and risk items, and ask follow-up questions in the chat.

### Using the Chrome Extension
1. Click the pinned T&C Analyzer icon in your Chrome toolbar.
2. Navigate to any Terms & Conditions webpage and click **Analyze Current Tab** (or paste text into the box).
3. The local Gemini Nano model will analyze the terms directly in your browser.
4. Go to the **Chat** tab to ask follow-up questions offline.

## Project Structure
- `app.py`: The main Streamlit application containing the UI and Langchain integration.
- `main.py`: The original CLI-based script for analyzing T&Cs.
- `chrome-extension/`: Folder containing the Chrome Extension source code.
  - `manifest.json`: Manifest configuration file.
  - `popup.html` / `popup.css` / `popup.js`: Extension user interface and controller.
  - `icon.svg`: Scaling vector graphics icon for the extension.
- `.env`: Environment variables configuration file (store your API keys here).

## Future Scope
- **Multi-format Support:** Extend document loaders to handle PDF and DOCX files.
- **Multi-lingual Support:** Automatic translation and analysis for non-English documents.
- **Personalized Risk Profiles:** Allow users to specify what terms they consider "dealbreakers".
