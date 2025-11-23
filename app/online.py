from flask import Blueprint, request
from flask_jwt_extended import jwt_required
import requests, os

online_bp = Blueprint("online", __name__)

PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY", None)
PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions"

@online_bp.post("")
@jwt_required()
def online_search():
    data = request.get_json(force=True)
    q = (data.get("query") or "").strip()
    if not q:
        return {"error": "query required"}, 400
    if not PERPLEXITY_API_KEY:
        return {"answer": f"[Demo] Online web result for: {q}\n\n(No Perplexity API key set. See docs.)", "matches": []}
    # Perplexity.ai API
    try:
        headers = {
            "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "sonar-pro",
            "messages": [
                {"role": "system", "content": "You are a highly skilled, kind, and thorough AI doctor. For each user message, answer and then always ask a single medically appropriate, clarifying next question that moves toward a diagnosis or differential. When you have enough information, say 'Assessment complete.' and summarize your findings."},
                {"role": "user", "content": q},
            ],
            "max_tokens": 512
        }
        resp = requests.post(PERPLEXITY_API_URL, headers=headers, json=payload, timeout=20)
        if not resp.ok:
            # Log and show API error reason
            return {"answer": f"Perplexity API error ({resp.status_code}): {resp.text}", "matches": []}
        jr = resp.json()
        answer = None
        sources = []
        if "choices" in jr and jr['choices']:
            choice = jr['choices'][0]
            answer = choice['message']['content']
            metadata = choice.get('metadata') or {}
            citations = metadata.get('citations') or jr.get('citations') or []
            for cite in citations:
                if isinstance(cite, str):
                    url = cite
                    title = ''
                else:
                    url = cite.get('url') or cite.get('source') or cite.get('link')
                    title = cite.get('title') or cite.get('text') or cite.get('snippet') or ''
                if not url:
                    continue
                sources.append({'source': url, 'text': title})
            # Fallback: scrape numbered references from the answer body
            if not sources and answer:
                import re
                lines = answer.split("\n")
                seen = set()
                for line in lines:
                    m = re.search(r'\[(\d+)]:?\s*(https?://\S+)', line)
                    if m:
                        url = m.group(2)
                        if url not in seen:
                            sources.append({'source': url, 'text': ''})
                            seen.add(url)
        return {"answer": answer, "matches": sources}
    except Exception as e:
        return {"answer": f"There was an error contacting the web API: {e}", "matches": []}
