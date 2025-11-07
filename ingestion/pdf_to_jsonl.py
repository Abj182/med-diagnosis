import json
import os
from typing import List
from pypdf import PdfReader


def read_pdf_text(path: str) -> str:
	reader = PdfReader(path)
	texts: List[str] = []
	for i, page in enumerate(reader.pages):
		try:
			texts.append(page.extract_text() or "")
		except Exception:
			texts.append("")
	return "\n\n".join(texts)


def chunk_text(text: str, chunk_size: int = 1200, overlap: int = 200) -> List[str]:
	text = " ".join(text.split())
	chunks: List[str] = []
	start = 0
	while start < len(text):
		end = min(start + chunk_size, len(text))
		chunks.append(text[start:end])
		if end == len(text):
			break
		start = end - overlap
		if start < 0:
			start = 0
	return chunks


def main():
	import argparse
	parser = argparse.ArgumentParser(description="Convert PDF to JSONL chunks")
	parser.add_argument("pdf_path", help="Path to source PDF")
	parser.add_argument("--out", default="knowledge.jsonl", help="Output JSONL path")
	parser.add_argument("--source", default="textbook", help="Source label to store in metadata")
	parser.add_argument("--chunk", type=int, default=1200, help="Chunk size (chars)")
	parser.add_argument("--overlap", type=int, default=200, help="Chunk overlap (chars)")
	args = parser.parse_args()

	text = read_pdf_text(args.pdf_path)
	chunks = chunk_text(text, args.chunk, args.overlap)
	with open(args.out, "w", encoding="utf-8") as f:
		for i, chunk in enumerate(chunks):
			obj = {"id": str(i), "text": chunk, "source": args.source}
			f.write(json.dumps(obj, ensure_ascii=False) + "\n")
	print(f"Wrote {len(chunks)} chunks to {args.out}")

if __name__ == "__main__":
	main()
