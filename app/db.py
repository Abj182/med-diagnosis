from flask import Flask
from flask_sqlalchemy import SQLAlchemy

# Global SQLAlchemy instance
_db = SQLAlchemy()

def init_db(app: Flask) -> None:
	_db.init_app(app)
	with app.app_context():
		_db.create_all()

def get_db() -> SQLAlchemy:
	return _db
