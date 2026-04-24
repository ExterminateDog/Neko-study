#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  echo "Usage: ./start-linux.sh"
  echo "Starts the Neko Study web app and API service."
  exit 0
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed or not in PATH."
  echo "Please install Node.js 20+ first."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is not installed or not in PATH."
  exit 1
fi

echo "Node: $(node -v)"
echo "npm: $(npm -v)"

if [[ ! -d "node_modules" ]]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Building frontend assets..."
npm run build

echo "Starting Neko Study in single-port mode..."
echo "Access URL: http://0.0.0.0:3001"
echo "Only port 3001 needs to be opened. The backend will serve the frontend pages and API together."
echo "Other devices on your LAN can access it using this machine's IP address and port 3001."
echo "Press Ctrl+C to stop."
npm start
