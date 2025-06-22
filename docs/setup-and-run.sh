#!/bin/bash

set -e

echo "Setting up RiskRadar Documentation environment..."

# Check for python3
if ! command -v python3 &> /dev/null; then
  echo "Python3 not found. Please install Python 3 before running this script."
  exit 1
fi

# Install mkdocs material and plugins
echo "Installing MkDocs Material and plugins..."
pip install mkdocs-material mkdocs-awesome-pages-plugin

echo "Setup complete!"

# Run mkdocs server
echo "Starting MkDocs live server at http://127.0.0.1:8000/"
mkdocs serve
