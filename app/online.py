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
                {"role": "system", "content": "You are a helpful assistant who returns direct, reliable, concise medical facts with sources from trusted sites like who.int, cdc.gov, medlineplus.gov, nhs.uk, mayo clinic, or research articles; always cite medical source links."},
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
            answer = jr['choices'][0]['message']['content']
            # Extract [n]: links
            lines = answer.split("\n")
            for line in lines:
                import re
                m = re.search(r'\[(\d+)]:?\s*(https?://\S+)', line)
                if m:
                    sources.append({'source': m.group(2), 'text': ''})
        return {"answer": answer, "matches": sources}
    except Exception as e:
        return {"answer": f"There was an error contacting the web API: {e}", "matches": []}
