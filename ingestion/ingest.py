import os
import json
from typing import List, Dict
from dataclasses import dataclass

from app.config import Settings
from app.embeddings import embed_texts
from pinecone import Pinecone, ServerlessSpec

@dataclass
class Chunk:
	id: str
	text: str
	source: str


def read_jsonl(path: str) -> List[Chunk]:
	chunks: List[Chunk] = []
	with open(path, "r", encoding="utf-8") as f:
		for i, line in enumerate(f):
			obj = json.loads(line)
			chunks.append(Chunk(id=str(obj.get("id", i)), text=obj["text"], source=obj.get("source", "kb")))
	return chunks


def main():
	settings = Settings()
	if not settings.PINECONE_API_KEY:
		raise RuntimeError("PINECONE_API_KEY not configured")

	pc = Pinecone(api_key=settings.PINECONE_API_KEY)
	existing = {idx["name"] for idx in pc.list_indexes()}
	if settings.PINECONE_INDEX not in existing:
		pc.create_index(
			name=settings.PINECONE_INDEX,
			dimension=384,
			metric="cosine",
			spec=ServerlessSpec(cloud=settings.PINECONE_CLOUD, region=settings.PINECONE_REGION),
		)
	index = pc.Index(settings.PINECONE_INDEX)

	jsonl_path = os.getenv("INGEST_JSONL", "knowledge.jsonl")
	chunks = read_jsonl(jsonl_path)
	texts = [c.text for c in chunks]
	embs = embed_texts(texts)
	if not embs or len(embs) != len(chunks):
		raise RuntimeError("Embedding failed. Check Sentence-Transformers installation.")

	vectors: List[Dict] = []
	for c, v in zip(chunks, embs):
		vectors.append({
			"id": c.id,
			"values": v,
			"metadata": {"text": c.text, "source": c.source},
		})

	# Upsert in batches
	batch = 100
	for i in range(0, len(vectors), batch):
		index.upsert(vectors=vectors[i:i+batch])
		print(f"Upserted {i+len(vectors[i:i+batch])}/{len(vectors)}")

	print("Ingestion complete.")

if __name__ == "__main__":
	main()
