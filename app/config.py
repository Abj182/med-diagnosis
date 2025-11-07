import os
from pathlib import Path
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment from backend/.env (one level above this file's directory)
_BACKEND_DIR = Path(__file__).resolve().parents[1]
_ENV_PATH = _BACKEND_DIR / ".env"
load_dotenv(dotenv_path=_ENV_PATH, override=False)

class Settings(BaseModel):
	# Flask / JWT / DB
	JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me-in-prod")
	DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./medassist.db")

	# Pinecone
	PINECONE_API_KEY: str = os.getenv("PINECONE_API_KEY", "")
	PINECONE_INDEX: str = os.getenv("PINECONE_INDEX", "medassist-index")
	PINECONE_CLOUD: str = os.getenv("PINECONE_CLOUD", "aws")
	PINECONE_REGION: str = os.getenv("PINECONE_REGION", "us-east-1")

	# Google Generative AI (Gemini) - generation only
	GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")
	GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "models/gemini-2.5-flash")

	# Embeddings: Sentence-Transformers (384-dim)
	SENTENCE_TRANSFORMER_MODEL: str = os.getenv("SENTENCE_TRANSFORMER_MODEL", "sentence-transformers/all-MiniLM-L6-v2")

	# Supabase
	SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
	SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")
