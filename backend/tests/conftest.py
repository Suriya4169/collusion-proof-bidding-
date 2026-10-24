"""Test environment: a fixed JWT secret so tokens are stable across the test session."""
import os

os.environ.setdefault("JWT_SECRET", "test-only-jwt-secret-0123456789-0123456789-abcdef")
# the in-process HTTP client addresses the app as "testserver"
os.environ.setdefault("MCP_ALLOWED_HOSTS", "testserver,localhost:*,127.0.0.1:*")
