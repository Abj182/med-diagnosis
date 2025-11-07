from typing import List, Dict, Any
from collections import defaultdict
from uuid import uuid4
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from .supabase_client import get_supabase

chats_bp = Blueprint("chats", __name__)

TABLE = "chat_history"


def _uid() -> int:
	return int(get_jwt_identity())


@chats_bp.get("/list")
@jwt_required()
def list_chats():
	sb = get_supabase()
	res = sb.table(TABLE).select("session_id,chat_type,role,content,timestamp").eq("user_id", _uid()).order("timestamp", desc=True).execute()
	rows: List[Dict[str, Any]] = res.data or []
	by_session: Dict[str, Dict[str, Any]] = {}
	# Build latest meta and title from first user message chronologically
	for r in reversed(rows):
		sid = r.get("session_id")
		if not sid:
			continue
		item = by_session.setdefault(sid, {"id": sid, "title": "New Chat", "tag": r.get("chat_type") or "textbook", "created_at": r.get("timestamp"), "last_ts": r.get("timestamp")})
		if r.get("role") == "user" and item.get("title") == "New Chat":
			item["title"] = (r.get("content") or "New Chat")[:40]
		if r.get("timestamp") and (item.get("created_at") is None or r["timestamp"] < item["created_at"]):
			item["created_at"] = r["timestamp"]
	# Update last_ts from descending pass
	for r in rows:
		sid = r.get("session_id")
		if sid in by_session:
			by_session[sid]["last_ts"] = r.get("timestamp") or by_session[sid].get("last_ts")
	chats = sorted(by_session.values(), key=lambda x: x.get("last_ts"), reverse=True)
	return {"chats": chats}


@chats_bp.get("/get")
@jwt_required()
def get_chat():
	sb = get_supabase()
	sid = request.args.get("id")
	if not sid:
		return {"error": "id required"}, 400
	res = sb.table(TABLE).select("role,content,timestamp").eq("user_id", _uid()).eq("session_id", sid).order("timestamp", desc=False).execute()
	rows = res.data or []
	messages = [{"role": "user" if r["role"] == "user" else "bot", "text": r["content"]} for r in rows]
	return {"chat": {"id": sid, "messages": messages}}


@chats_bp.post("/create")
@jwt_required()
def create_chat():
	data = request.get_json(silent=True) or {}
	tag = (data.get("tag") or "textbook").strip()
	# generate a session id client could also provide
	session_id = str(uuid4())
	return {"id": session_id, "title": "New Chat", "tag": tag}, 201


@chats_bp.post("/append")
@jwt_required()
def append_message():
	data = request.get_json(force=True)
	sid = data.get("id")
	role = data.get("role")
	text = data.get("text")
	chat_type = (data.get("tag") or "textbook").strip()
	if not sid or role not in ("user", "bot", "assistant") or not text:
		return {"error": "id, role, text required"}, 400
	if role == "bot":
		role = "assistant"
	sb = get_supabase()
	sb.table(TABLE).insert({
		"user_id": _uid(),
		"session_id": sid,
		"chat_type": chat_type,
		"role": role,
		"content": text,
	}).execute()
	return {"ok": True}


@chats_bp.post("/rename")
@jwt_required()
def rename_chat():
	# No-op with current schema; title derived from first user message
	return {"ok": True}


@chats_bp.delete("/delete")
@jwt_required()
def delete_chat():
	sid = request.args.get("id")
	if not sid:
		return {"error": "id required"}, 400
	sb = get_supabase()
	sb.table(TABLE).delete().eq("user_id", _uid()).eq("session_id", sid).execute()
	return {"ok": True}


@chats_bp.post("/clear")
@jwt_required()
def clear_all():
	sb = get_supabase()
	sb.table(TABLE).delete().eq("user_id", _uid()).execute()
	return {"ok": True}
