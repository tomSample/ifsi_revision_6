"""
Main Flask application
Refactored with modular structure: config, routes, utils
"""
import os
import sys
import importlib.util
from pathlib import Path

# Add backend dir to path to import modules
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

from flask import Flask, jsonify
from flask_cors import CORS
from flask_compress import Compress
from flask_talisman import Talisman

# Import configuration
from config import (
    FLASK_ENV, FLASK_DEBUG, FLASK_HOST, FLASK_PORT,
    CORS_ORIGINS, MAX_CONTENT_LENGTH, SECRET_KEY, BASE_DIR
)

# Import logger
from utils.logger import setup_logger

# Setup logger
logger = setup_logger(__name__)

# Create Flask app (without static folder - we handle static via blueprints)
app = Flask(__name__)

# Configuration
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH
app.config['SECRET_KEY'] = SECRET_KEY
app.config['ENV'] = FLASK_ENV
app.config['DEBUG'] = FLASK_DEBUG

# Enable compression
Compress(app)

# Security headers (only in production)
if FLASK_ENV == 'production':
    Talisman(app, force_https=True)
else:
    # Development: allow all CORS
    CORS(app, origins='*', allow_headers=['*'], methods=['*'])

# Error handlers
@app.errorhandler(400)
def bad_request(e):
    logger.warning(f"Bad request: {e}")
    return jsonify({'error': 'Bad request'}), 400


@app.errorhandler(404)
def not_found(e):
    logger.warning(f"Not found: {e}")
    return jsonify({'error': 'Resource not found'}), 404


@app.errorhandler(500)
def internal_error(e):
    logger.error(f"Internal server error: {e}", exc_info=True)
    return jsonify({'error': 'Internal server error'}), 500


# Register blueprints
logger.info("Registering API blueprints...")

from routes.static import bp as static_bp
from routes.courses import bp as courses_bp
from routes.images import bp as images_bp
from routes.data import bp as data_bp
from routes.api import bp as api_bp

app.register_blueprint(static_bp)
app.register_blueprint(courses_bp)
app.register_blueprint(images_bp)
app.register_blueprint(data_bp)
app.register_blueprint(api_bp)

# Keep the course upload API compatible with the admin interface. These
# handlers are loaded from the last complete implementation preserved during
# the backend refactor.
_legacy_app_path = os.path.join(SCRIPT_DIR, 'app-old-backup.py')
_legacy_spec = importlib.util.spec_from_file_location('legacy_app', _legacy_app_path)
if _legacy_spec is None or _legacy_spec.loader is None:
    raise ImportError(f"Unable to load legacy upload handlers from {_legacy_app_path}")
_legacy_app = importlib.util.module_from_spec(_legacy_spec)
_legacy_spec.loader.exec_module(_legacy_app)


@app.route('/api/extract_odt', methods=['POST'])
def extract_odt():
    return _legacy_app.extract_odt()


@app.route('/api/check_course', methods=['POST'])
def check_course():
    return _legacy_app.check_course()


@app.route('/api/add_course', methods=['POST'])
def add_course():
    return _legacy_app.add_course()


@app.route('/api/update_course', methods=['POST'])
def update_course():
    return _legacy_app.update_course()


@app.route('/api/delete_course', methods=['DELETE'])
def delete_course():
    return _legacy_app.delete_course()


logger.info("All blueprints registered successfully")


# Health check endpoint
@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'environment': FLASK_ENV,
        'version': '2.0'
    })


@app.before_request
def log_request():
    """Log incoming requests"""
    from flask import request
    logger.debug(f"{request.method} {request.path}")


@app.after_request
def add_security_headers(response):
    """Add security headers to response"""
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    
    if FLASK_ENV == 'production':
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    
    return response


# Startup message
def startup():
    """Log startup information"""
    logger.info(f"Application started in {FLASK_ENV} mode")
    logger.info(f"Debug mode: {FLASK_DEBUG}")
    logger.info(f"Listening on {FLASK_HOST}:{FLASK_PORT}")


if __name__ == '__main__':
    logger.info(f"Starting Flask server...")
    startup()
    app.run(
        host=FLASK_HOST,
        port=FLASK_PORT,
        debug=FLASK_DEBUG,
        use_reloader=FLASK_ENV == 'development'
    )
