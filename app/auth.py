from flask import Blueprint, request
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
import bcrypt
from .supabase_client import get_supabase

auth_bp = Blueprint("auth", __name__)

@auth_bp.post("/register")
def register():
	data = request.get_json(force=True)
	email = (data.get("email") or "").strip().lower()
	password = data.get("password") or ""
	if not email or not password:
		return {"error": "email and password are required"}, 400
	pw_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
	sb = get_supabase()
	# Check existing
	existing = sb.table("users").select("id").eq("email", email).execute()
	if existing.data:
		return {"error": "email already registered"}, 409
	# Insert
	res = sb.table("users").insert({"email": email, "password_hash": pw_hash}).execute()
	user = res.data[0] if res.data else {"email": email}
	return {"message": "registered", "user": {"id": user.get("id"), "email": user.get("email")}}, 201

@auth_bp.post("/login")
def login():
	data = request.get_json(force=True)
	email = (data.get("email") or "").strip().lower()
	password = data.get("password") or ""
	if not email or not password:
		return {"error": "email and password are required"}, 400
	sb = get_supabase()
	res = sb.table("users").select("id,email,password_hash").eq("email", email).limit(1).execute()
	if not res.data:
		return {"error": "invalid credentials"}, 401
	user = res.data[0]
	if not bcrypt.checkpw(password.encode("utf-8"), user["password_hash"].encode("utf-8")):
		return {"error": "invalid credentials"}, 401
	token = create_access_token(identity=str(user["id"]))
	return {"access_token": token, "user": {"id": user["id"], "email": user["email"]}}

@auth_bp.get("/me")
@jwt_required()
def me():
	uid = get_jwt_identity()
	sb = get_supabase()
	res = sb.table("users").select("id,email,created_at").eq("id", int(uid)).limit(1).execute()
	if not res.data:
		return {"error": "user not found"}, 404
	user = res.data[0]
	return {"user": {"id": user.get("id"), "email": user.get("email"), "created_at": user.get("created_at")}}
