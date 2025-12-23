#!/bin/bash

# ============================================================================
# SERVE FRONTEND LOCALLY
# ============================================================================
# Builds and serves the frontend locally using Vite preview
# ============================================================================

set -e

echo "🚀 Serving Frontend Locally..."
echo ""

# Check if build directory exists
if [ ! -d "build" ]; then
  echo "📦 Building frontend..."
  npm run build || {
    echo "❌ Build failed"
    exit 1
  }
  echo "✅ Build complete"
  echo ""
fi

echo "✅ Build directory ready: $(du -sh build 2>/dev/null | cut -f1 || echo 'ready')"
echo ""

# Get port from environment or use default
PORT="${PORT:-3000}"
HOST="${HOST:-localhost}"

echo "🌐 Starting local server..."
echo "   URL: http://${HOST}:${PORT}"
echo ""
echo "   Press Ctrl+C to stop"
echo ""

# Serve using Vite preview (best option for production builds)
if command -v npx &> /dev/null; then
  npx vite preview --host "$HOST" --port "$PORT"
elif command -v vite &> /dev/null; then
  vite preview --host "$HOST" --port "$PORT"
else
  # Fallback to Python HTTP server
  echo "⚠️  Vite not found, using Python HTTP server..."
  cd build
  python3 -m http.server "$PORT"
fi

