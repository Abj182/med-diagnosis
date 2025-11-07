from supabase import create_client, Client
from .config import Settings

_settings = Settings()
_supabase: Client | None = None

def get_supabase() -> Client:
	global _supabase
	if _supabase is None:
		if not _settings.__dict__.get('SUPABASE_URL') or not _settings.__dict__.get('SUPABASE_SERVICE_KEY'):
			raise RuntimeError("Supabase not configured: SUPABASE_URL and SUPABASE_SERVICE_KEY required")
		_supabase = create_client(_settings.SUPABASE_URL, _settings.SUPABASE_SERVICE_KEY)
	return _supabase
