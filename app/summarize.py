from typing import List
import google.generativeai as genai
from .config import Settings
from .embeddings import embed_texts

_settings = Settings()

if _settings.GOOGLE_API_KEY:
	genai.configure(api_key=_settings.GOOGLE_API_KEY)


def summarize_segments(question: str, segments: List[str]) -> str:
	if not _settings.GOOGLE_API_KEY:
		return ""
	model = genai.GenerativeModel(_settings.GEMINI_MODEL)
	context = "\n\n".join(f"- {s}" for s in segments)
	prompt = (
		"You are a medical assistant. Using ONLY the following retrieved context, "
		"answer the user's question concisely and clearly. If uncertain, say so.\n\n"
		f"Question: {question}\n\nContext:\n{context}"
	)
	resp = model.generate_content(prompt)
	return resp.text.strip() if getattr(resp, "text", None) else ""
