from typing import List
from flask import Blueprint, request
from .config import Settings
from .embeddings import embed_texts
from .summarize import summarize_segments

from pinecone import Pinecone, ServerlessSpec

rag_bp = Blueprint("rag", __name__)
_settings = Settings()

# Lazy init Pinecone client and index
_pc = None
_index = None


def _get_index():
	global _pc, _index
	if _pc is None:
		_pc = Pinecone(api_key=_settings.PINECONE_API_KEY)
	if _index is None:
		existing = {idx["name"] for idx in _pc.list_indexes()}
		if _settings.PINECONE_INDEX not in existing and _settings.PINECONE_API_KEY:
			_pc.create_index(
				name=_settings.PINECONE_INDEX,
				dimension=384,
				metric="cosine",
				spec=ServerlessSpec(cloud=_settings.PINECONE_CLOUD, region=_settings.PINECONE_REGION),
			)
		_index = _pc.Index(_settings.PINECONE_INDEX)
	return _index


@rag_bp.get("/stats")
def stats():
	if not _settings.PINECONE_API_KEY:
		return {"error": "PINECONE_API_KEY not configured"}, 400
	index = _get_index()
	try:
		stat = index.describe_index_stats()
		return {
			"index": _settings.PINECONE_INDEX,
			"namespaces": stat.get("namespaces", {}),
			"dimension": stat.get("dimension"),
		}
	except Exception as e:
		return {"error": str(e)}, 500


@rag_bp.post("/query")
def query_rag():
	if not _settings.PINECONE_API_KEY:
		return {"error": "PINECONE_API_KEY not configured"}, 400
	payload = request.get_json(force=True)
	query = (payload.get("query") or "").strip()
	top_k = int(payload.get("topK") or 5)
	if not query:
		return {"error": "query is required"}, 400

	# Embed the query with 384-dim Sentence-Transformers
	embeds = embed_texts([query])
	if not embeds:
		return {"error": "embedding failed"}, 500
	qvec = embeds[0]

	index = _get_index()
	res = index.query(vector=qvec, top_k=top_k, include_metadata=True)

	matches = []
	segments: List[str] = []
	for m in res.get("matches", []):
		meta = m.get("metadata", {}) or {}
		text = meta.get("text") or meta.get("chunk") or ""
		segments.append(text)
		matches.append({
			"id": m.get("id"),
			"score": m.get("score"),
			"source": meta.get("source", "unknown"),
			"text": text,
		})

	answer = summarize_segments(query, segments) if segments else ""

	return {
		"query": query,
		"answer": answer,
		"matches": matches,
	}
