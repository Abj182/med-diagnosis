## MedAssist Backend (Flask)

### Prerequisites
- Python 3.10+

### Setup
1. Create and activate a virtual environment (Windows PowerShell):
```powershell
python -m venv .venv
./.venv/Scripts/Activate.ps1
```

2. Install dependencies:
```powershell
pip install -r backend/requirements.txt
```

3. Configure environment variables (create a `.env` in `backend/` based on keys below):
```
JWT_SECRET=change-me-in-prod
DATABASE_URL=sqlite:///./medassist.db
PINECONE_API_KEY=
PINECONE_INDEX=medassist-index
PINECONE_CLOUD=aws
PINECONE_REGION=us-east-1
GOOGLE_API_KEY=
GEMINI_MODEL=models/gemini-2.5-flash
EMBEDDING_MODEL=models/text-embedding-004
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
```

4. Supabase: create a `users` table (SQL):
```sql
create table if not exists public.users (
	id bigserial primary key,
	email text unique not null,
	password_hash text not null,
	created_at timestamptz not null default now()
);
```
Use the Service Role key for `SUPABASE_SERVICE_KEY` (server-only!).

5. Run the server:
```powershell
$env:FLASK_DEBUG=1
python backend/run.py
```
The API will be on http://localhost:8000

### Upload your textbook to Pinecone (RAG)
1) Convert your textbook (PDF → JSONL):
```powershell
# Example
python backend/ingestion/pdf_to_jsonl.py "C:\path\to\textbook.pdf" --out knowledge.jsonl --source textbook --chunk 1200 --overlap 200
```
Alternatively, if you already have a .txt file:
```powershell
python backend/ingestion/text_to_jsonl.py "C:\path\to\textbook.txt" --out knowledge.jsonl --source textbook --chunk 1200 --overlap 200
```

2) Ingest JSONL into Pinecone (embeds with models/text-embedding-004):
```powershell
$env:INGEST_JSONL="knowledge.jsonl"
python backend/ingestion/ingest.py
```
Make sure your `.env` has `PINECONE_API_KEY` and `GOOGLE_API_KEY` set. The script will create the index if missing and upsert vectors (batching by 100).

3) Test RAG:
- Start the server and open http://localhost:8000
- Ask questions from the textbook; the overlay shows the retrieved segments, the main answer is a Gemini summary grounded to those segments.

### Endpoints
- POST `/api/auth/register` { email, password }
- POST `/api/auth/login` { email, password } -> { access_token }
- GET `/api/auth/me` (Authorization: Bearer <token>)
- POST `/api/rag/query` { query, topK? }

## Embeddings and Models
- Embeddings: Sentence-Transformers (`sentence-transformers/all-MiniLM-L6-v2`) → 384 dimensions
- RAG Index: Pinecone with `metric=cosine`, `dimension=384`
- Generation/Summarization: Gemini (`models/gemini-2.5-flash`)

### Env keys
```
SENTENCE_TRANSFORMER_MODEL=sentence-transformers/all-MiniLM-L6-v2
```

### Ingestion
Embeddings are generated locally using Sentence-Transformers. Ensure the host can install `torch` and `sentence-transformers`. On free hosting, do ingestion locally and just query in production.

## Deployment (Render / Railway)

Both platforms work. Use the provided `backend/Procfile` and set environment variables from your `backend/.env`.

### Render
- Create a new Web Service from your Git repo
- Root Directory: project root (contains `backend/`)
- Build Command:
```
pip install -r backend/requirements.txt
```
- Start Command (already in Procfile):
```
web: gunicorn --chdir backend 'app:create_app()' --bind 0.0.0.0:${PORT:-8000}
```
- Environment: add all keys from `backend/.env.example`

### Railway
- Create a new Service from repo
- Nixpacks/Python will detect and install
- Set Install command (if needed):
```
pip install -r backend/requirements.txt
```
- Start command:
```
gunicorn --chdir backend 'app:create_app()' --bind 0.0.0.0:${PORT:-8000}
```
- Add environment variables from `backend/.env.example`

Notes:
- Ensure `GOOGLE_API_KEY` and `PINECONE_API_KEY` are set in the service environment.
- Use Supabase Service Role for `SUPABASE_SERVICE_KEY` (server only). Do not expose it client-side.
- If the platform sets `PORT`, the Procfile already respects it.
