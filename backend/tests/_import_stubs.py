"""Import ``src.main`` on a machine that lacks the heavy AI libraries (LangGraph, Chroma, sentence-transformers ...).

Tests that audit the real FastAPI app (every route, every guard) need ``src.main`` importable, but these tests never
run an agent. ``install()`` adds a last-resort import hook that supplies an inert stand-in for a library **only if it
is not installed**, so on a fully provisioned machine the real libraries are used and nothing is faked.
"""
import importlib.abc
import importlib.machinery
import sys
from unittest.mock import MagicMock

HEAVY_ROOTS = frozenset({
    "fitz", "google", "langchain", "langchain_chroma", "langchain_community", "langchain_core",
    "langchain_google_genai", "langchain_huggingface", "langchain_text_splitters", "langgraph", "chromadb",
    "networkx", "nltk", "pandas", "pdfplumber", "rank_bm25", "sentence_transformers", "sklearn", "torch",
    "transformers",
})


class _MissingLibraryStub(importlib.abc.MetaPathFinder, importlib.abc.Loader):
    def find_spec(self, name, path, target=None):
        if name.split(".")[0] in HEAVY_ROOTS:
            return importlib.machinery.ModuleSpec(name, self, is_package=True)
        return None

    def create_module(self, spec):
        module = MagicMock(name=spec.name)
        module.__path__ = []
        module.__name__ = spec.name
        module.__spec__ = spec
        module.__loader__ = self
        return module

    def exec_module(self, module):
        pass


def install() -> None:
    if not any(isinstance(f, _MissingLibraryStub) for f in sys.meta_path):
        sys.meta_path.append(_MissingLibraryStub())  # appended: real, installed libraries always win
