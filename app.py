import streamlit as st
from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import PromptTemplate 
from langchain_community.document_loaders import WebBaseLoader
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv()

st.set_page_config(page_title="T&C Analyzer", layout="wide")

st.title("Terms & Conditions Analyzer")
st.write("Paste the URL of the Terms & Conditions or paste the text directly.")

# setup LLM & Chains
@st.cache_resource
def get_model():
    llm = ChatOpenAI(
        model="qwen/qwen3-coder-next",  # or any OpenRouter model
        openai_api_base="https://openrouter.ai/api/v1",
        max_tokens=1000, # limits the output length
        temperature=0,
    )
    return llm

try:
    model = get_model()
except Exception as e:
    st.error(f"Error loading model: {e}")
    st.stop()

# initialize session state variables
if "summary" not in st.session_state:
    st.session_state.summary = None
if "offensive_terms" not in st.session_state:
    st.session_state.offensive_terms = None
if "messages" not in st.session_state:
    st.session_state.messages = []
if "chat_history" not in st.session_state:
    st.session_state.chat_history = []
if "doc_text" not in st.session_state:
    st.session_state.doc_text = ""

def clean_extracted_html(soup: BeautifulSoup) -> str:
    """Decompose noise elements (nav, header, footer, scripts) from parsed HTML."""
    for tag in soup(["script", "style", "header", "footer", "nav", "aside", "noscript", "svg", "form"]):
        tag.decompose()
    main_content = soup.find("main") or soup.find("article") or soup.body or soup
    return main_content.get_text(separator="\n", strip=True)

# file uploader & input options
input_method = st.radio("Choose input method:", ["URL Link", "Paste Text"])

whole_text = ""
text_loaded = False

if input_method == "URL Link":
    url_input = st.text_input("Enter the URL of the Terms & Conditions:")
    if url_input:
        try:
            with st.spinner("Scraping webpage..."):
                loader = WebBaseLoader(url_input)
                soup = loader.scrape()
                whole_text = clean_extracted_html(soup)
                if whole_text.strip():
                    text_loaded = True
        except Exception as e:
            st.error(f"Failed to load URL: {e}")

elif input_method == "Paste Text":
    raw_text = st.text_area("Paste the Terms & Conditions text here:", height=200)
    if raw_text.strip():
        # Clean HTML tags if pasted text is raw HTML markup
        if "<html" in raw_text.lower() or "<body" in raw_text.lower() or "<div" in raw_text.lower():
            soup = BeautifulSoup(raw_text, "html.parser")
            whole_text = clean_extracted_html(soup)
        else:
            whole_text = raw_text.strip()
        text_loaded = bool(whole_text)

button = st.button("Analyze Document")

if button:
    if not text_loaded or not whole_text.strip():
        st.error("Please provide a valid URL or paste non-empty Terms & Conditions text first.")
    else:
        with st.spinner("Analyzing document..."):
            parser = StrOutputParser()
            prompt1 = PromptTemplate(
                template="Provide a very short, high-level summary of the following terms and conditions:\n\n{text}",
                input_variables=["text"]
            )
            prompt2 = PromptTemplate(
                template="Based on the following terms and conditions, list the top 7 most offensive or risky clauses. Format the output strictly as a bulleted list, where each bullet contains a very brief explanation of the clause:\n\n{text}",
                input_variables=["text"]
            )
            
            chain1 = prompt1 | model | parser
            chain2 = prompt2 | model | parser
            
            status_text = st.empty()
            status_text.text("Summarizing the document...")
            
            # summarize the whole text
            final_summary = chain1.invoke({"text": whole_text})
            
            status_text.text("Extracting offensive terms from the document...")
            
            # find offensive terms from the whole text
            final_offensive = chain2.invoke({"text": whole_text})
            
            if not final_offensive or len(final_offensive.strip()) <= 5:
                final_offensive = "No highly offensive terms found."
            
            st.session_state.doc_text = whole_text
            st.session_state.summary = final_summary
            st.session_state.offensive_terms = final_offensive
            
            status_text.empty()
            
            # initialize chat display messages and typed model history
            st.session_state.messages = []
            st.session_state.chat_history = [
                SystemMessage(
                    content=(
                        "You are an AI legal assistant analyzing a Terms and Conditions document. "
                        "You must ONLY answer questions directly related to this document. "
                        "If the question is irrelevant, refuse to answer politely. "
                        "Answer questions accurately and concisely without unnecessary legal jargon.\n\n"
                        f"Document Context:\n{whole_text}"
                    )
                )
            ]
            st.rerun()

if st.session_state.summary is not None:
    st.markdown("Analysis Results:")
    col1, col2 = st.columns(2)
    with col1:
        st.subheader("Summary:")
        st.info(st.session_state.summary)
    with col2:
        st.subheader("Offensive Terms:")
        st.warning(st.session_state.offensive_terms)
        
    st.divider()
    st.markdown("Chat:")
    
    # display chat messages from history on app rerun
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])

    # react to user input
    if prompt := st.chat_input("Ask a question about the Terms & Conditions..."):
        # display user message in chat message container
        st.chat_message("user").markdown(prompt)
        
        # add user message to UI and model chat history
        st.session_state.messages.append({"role": "user", "content": prompt})
        st.session_state.chat_history.append(HumanMessage(content=prompt))

        with st.chat_message("assistant"):
            with st.spinner("Thinking..."):
                chatresult = model.invoke(st.session_state.chat_history)
                response_text = chatresult.content
                st.markdown(response_text)
                
        # add AI response to UI and model chat history
        st.session_state.messages.append({"role": "assistant", "content": response_text})
        st.session_state.chat_history.append(AIMessage(content=response_text))
