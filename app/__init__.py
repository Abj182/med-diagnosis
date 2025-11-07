from flask import Flask, redirect
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from .config import Settings
from .db import init_db

jwt = JWTManager()

def create_app() -> Flask:
	app = Flask(__name__, static_folder="static", static_url_path="/static")
	settings = Settings()

	app.config["JWT_SECRET_KEY"] = settings.JWT_SECRET
	app.config["SQLALCHEMY_DATABASE_URI"] = settings.DATABASE_URL
	app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"pool_pre_ping": True}

	CORS(app, supports_credentials=True)
	jwt.init_app(app)
	init_db(app)

	# Register blueprints
	from .auth import auth_bp
	from .rag import rag_bp
	from .chats import chats_bp
	from .online import online_bp

	app.register_blueprint(auth_bp, url_prefix="/api/auth")
	app.register_blueprint(rag_bp, url_prefix="/api/rag")
	app.register_blueprint(chats_bp, url_prefix="/api/chats")
	app.register_blueprint(online_bp, url_prefix="/api/online")

	@app.get("/")
	def root():
		return redirect("/login")

	@app.get("/login")
	def login_page():
		return app.send_static_file("login.html")

	@app.get("/register")
	def register_page():
		return app.send_static_file("register.html")

	@app.get("/home")
	def home_page():
		return app.send_static_file("home.html")

	@app.get("/api/health")
	def health():
		return {"status": "ok"}

	return app
