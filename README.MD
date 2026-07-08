# ⚖️ Terms & Conditions Analyzer

## Overview
The **Terms & Conditions Analyzer** is an AI-powered application designed to help users quickly understand long and complex legal documents. By leveraging Large Language Models (LLMs), this tool bridges the gap between complex legal jargon and everyday users, mitigating the risks associated with blind agreements.


## Features
- **Flexible Document Ingestion:** Provide a URL to scrape the terms directly from a website, or paste the raw text into the app.
- **Document Summarization:** Get a clear, concise summary of the terms within seconds.
- **Risk Extraction:** Automatically identifies and highlights the most offensive, unfair, or highly risky clauses hidden in the fine print as bullet points.
- **Interactive Chat:** An integrated chatbot interface allows you to ask follow-up questions about the document and get immediate answers.

## Technologies Used
- **Frontend Framework:** Streamlit (for building an interactive and easy-to-use web app)
- **AI/LLM Orchestration:** Langchain (TextLoader, WebBaseLoader, PromptTemplate, StrOutputParser)
- **Language Model:** Qwen/Qwen3-Coder-Next via OpenRouter API
- **Environment Management:** Python `dotenv` for handling API keys

## Installation

1. **Clone the repository:**
   ```bash
   git clone <repository_url>
   cd "t&c checker"
   ```

2. **Create a virtual environment (Optional but recommended):**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   ```

3. **Install the required dependencies:**
   Make sure you have the necessary libraries installed. 
   ```bash
   pip install streamlit langchain langchain-openai langchain-community python-dotenv beautifulsoup4
   ```

4. **Set up environment variables:**
   Create a `.env` file in the root directory and add your OpenRouter API Token:
   ```env
   OPENAI_API_KEY=your_openrouter_api_token_here
   ```

## Usage

1. **Run the Streamlit application:**
   ```bash
   streamlit run app.py
   ```

2. **Interact with the App:**
   - Open the provided local URL in your web browser (usually `http://localhost:8501`).
   - Use the radio button to select your input method: **URL Link** or **Paste Text**.
   - **URL Link:** Provide the direct link to the webpage containing the terms (e.g., *https://developer.chrome.com/docs/webstore/program-policies/terms*). The app will automatically scrape and analyze it.
   - **Paste Text:** Paste the raw text natively into the text box. The app will automatically analyze the contents.
   - View the generated **Summary** and **Offensive Terms** at the top of the interface.
   - Use the chat input box at the bottom to ask custom questions about the analyzed document.

## Project Structure
- `app.py`: The main Streamlit application containing the UI and Langchain integration.
- `main.py`: The original CLI-based script for analyzing T&Cs.
- `.env`: Environment variables configuration file (store your API keys here).

## Future Scope
- **Multi-format Support:** Extend document loaders to handle PDF and DOCX files.
- **Browser Extension:** Enable real-time analysis of T&Cs while browsing signing pages.
- **Multi-lingual Support:** Automatic translation and analysis for non-English documents.
- **Personalized Risk Profiles:** Allow users to specify what terms they consider "dealbreakers".
