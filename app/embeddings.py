from typing import List
from sentence_transformers import SentenceTransformer
from .config import Settings

_settings = Settings()
_model: SentenceTransformer | None = None


def _load_model() -> SentenceTransformer:
	global _model
	if _model is None:
		_model = SentenceTransformer(_settings.SENTENCE_TRANSFORMER_MODEL)
	return _model


def embed_texts(texts: List[str]) -> List[List[float]]:
	model = _load_model()
	# Normalize to be cosine-friendly
	embs = model.encode(texts, normalize_embeddings=True, convert_to_numpy=True)
	return [e.tolist() for e in embs]
