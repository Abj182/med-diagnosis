from datetime import datetime
from .db import get_db

_db = get_db()

class User(_db.Model):
	__tablename__ = "users"
	id = _db.Column(_db.Integer, primary_key=True)
	email = _db.Column(_db.String(255), unique=True, nullable=False, index=True)
	password_hash = _db.Column(_db.String(255), nullable=False)
	created_at = _db.Column(_db.DateTime, default=datetime.utcnow)

	def to_safe_dict(self) -> dict:
		return {"id": self.id, "email": self.email, "created_at": self.created_at.isoformat()}

class DocumentChunk(_db.Model):
	__tablename__ = "document_chunks"
	id = _db.Column(_db.Integer, primary_key=True)
	source = _db.Column(_db.String(512), nullable=False)
	text = _db.Column(_db.Text, nullable=False)
	created_at = _db.Column(_db.DateTime, default=datetime.utcnow)
