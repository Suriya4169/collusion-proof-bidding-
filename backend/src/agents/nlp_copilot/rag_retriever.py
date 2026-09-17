import os
from typing import List
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings

def chunk_text(text: str) -> List[str]:
    """
    Splits a large document into smaller semantic chunks.
    Uses RecursiveCharacterTextSplitter to ensure paragraphs/sentences stay together.
    """
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1500,     # Break into ~1500 character pieces
        chunk_overlap=200,   # Keep 200 chars of overlap so we don't cut a rule in half
        separators=["\n\n", "\n", " ", ""] # Try to split by paragraph first
    )
    
    chunks = text_splitter.split_text(text)
    return chunks

def build_hybrid_retriever(chunks: List[str]):
    """
    Builds the Retriever (Using Pure Semantic for now due to Langchain v0.3 bug)
    """
    embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")
    vectorstore = Chroma.from_texts(texts=chunks, embedding=embeddings)
    return vectorstore.as_retriever(search_kwargs={"k": 4})

def retrieve_relevant_chunks(retriever, query: str) -> str:
    """
    Searches using the Retriever and combines the results.
    """
    results = retriever.invoke(query)
    
    # Combine the found chunks back into a single string for Gemini to read
    combined_text = "\n\n--- NEXT CHUNK ---\n\n".join([doc.page_content for doc in results])
    return combined_text
