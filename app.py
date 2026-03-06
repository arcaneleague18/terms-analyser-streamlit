import streamlit as st
# from langchain_huggingface import ChatHuggingFace, HuggingFaceEndpoint
from langchain_openai import ChatOpenAI

# from langchain_community.document_loaders import TextLoader
# from langchain_text_splitters import RecursiveCharacterTextSplitter  
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import PromptTemplate 

from langchain_community.document_loaders import WebBaseLoader
from langchain_core.documents import Document
from dotenv import load_dotenv

load_dotenv()
api_key = st.secrets["OPENAI_API_KEY"]

st.set_page_config(page_title="T&C Analyzer", page_icon="⚖️", layout="wide")

st.title("⚖️ Terms & Conditions Analyzer")
st.write("Paste the URL of the Terms & Conditions or paste the text directly.")

# setup LLM & Chains
@st.cache_resource
def get_model():
    llm = ChatOpenAI(
        model="qwen/qwen3-coder-next",  # or any OpenRouter model
        openai_api_base="https://openrouter.ai/api/v1",
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

# file uploader & input options
input_method = st.radio("Choose input method:", ["URL Link", "Paste Text"])

documents = []
text_loaded = False


if input_method == "URL Link":
    url_input = st.text_input("Enter the URL of the Terms & Conditions:")
    if url_input:
        try:
            with st.spinner("Scraping webpage..."):
                loader = WebBaseLoader(url_input)
                documents = loader.load()
                text_loaded = True
        except Exception as e:
            st.error(f"Failed to load URL: {e}")

elif input_method == "Paste Text":
    raw_text = st.text_area("Paste the Terms & Conditions text here:", height=200)
    if raw_text.strip():
        documents = [Document(page_content=raw_text)]
        text_loaded = True

if text_loaded and st.session_state.summary is None:
    if st.button("Analyze Document"):
        with st.spinner("Analyzing document..."):
            
            if not documents:
                st.error("Document is empty or could not be parsed.")
                st.stop()
                
            whole_text = documents[0].page_content
            
            if len(whole_text.strip()) == 0:
                st.error("The loaded text is empty.")
                st.stop()
            
            parser = StrOutputParser()
            prompt1 = PromptTemplate(
                template="Summarize the following set of terms and conditions in a clear, brief and consise way: {text}",
                input_variables=["text"]
            )
            prompt2 = PromptTemplate(
                template="Based on the following set of terms and conditions, list out the most offensive ones as bullet points briefly: {text} \n ",
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
            
            st.session_state.summary = final_summary
            st.session_state.offensive_terms = final_offensive
            
            status_text.empty()
            
            # initialize display messages 
            st.session_state.messages = []
            
            st.session_state.chat_history = [final_summary, final_offensive]
            st.rerun()

if st.session_state.summary is not None:
    st.markdown("Analysis Results:")
    col1, col2 = st.columns(2)
    with col1:
        st.subheader("📝 Summary:")
        st.info(st.session_state.summary)
    with col2:
        st.subheader("🚩 Offensive Terms:")
        st.warning(st.session_state.offensive_terms)
        
    st.divider()
    st.markdown("💬 Chat:")
    
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
        st.session_state.chat_history.append(prompt + "briefly without any jargon")

        with st.chat_message("assistant"):
            with st.spinner("Thinking..."):
                chatresult = model.invoke(st.session_state.chat_history)
                response_text = chatresult.content
                st.markdown(response_text)
                
        # add AI response to UI and model chat history
        st.session_state.messages.append({"role": "assistant", "content": response_text})
        st.session_state.chat_history.append(response_text)
