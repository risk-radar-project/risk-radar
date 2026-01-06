#!/bin/bash
# =============================================================================
# Setup script for AI model files (Git LFS)
# Run before Docker build or local development
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODEL_DIR="$SCRIPT_DIR/detector_model_components"

echo "🔍 Checking AI model files..."
echo ""

# Check Git LFS installation
if ! command -v git-lfs &> /dev/null; then
    echo "⚠️  Git LFS not installed!"
    echo "  macOS:   brew install git-lfs"
    echo "  Ubuntu:  apt-get install git-lfs"
    exit 1
fi

# Pull LFS files
echo "📥 Pulling Git LFS files..."
cd "$SCRIPT_DIR/../.."
git lfs install --local 2>/dev/null || true
git lfs pull

echo ""
echo "✅ Verifying model files..."

check_file() {
    local file="$1"
    local min_size="$2"
    local name=$(basename "$file")
    
    [ ! -f "$file" ] && echo "❌ Missing: $name" && return 1
    
    head -c 50 "$file" 2>/dev/null | grep -q "version https://git-lfs" && \
        echo "❌ LFS pointer: $name (run git lfs pull)" && return 1
    
    local size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
    [ "$size" -lt "$min_size" ] && echo "❌ Too small: $name" && return 1
    
    local size_mb=$((size / 1048576))
    [ "$size_mb" -gt 0 ] && echo "✓ $name (${size_mb}MB)" || echo "✓ $name (${size}B)"
    return 0
}

ERRORS=0
check_file "$MODEL_DIR/bert_model_finetuned.pth" 100000000 || ERRORS=$((ERRORS+1))
check_file "$MODEL_DIR/fake_detector_head.pth" 100000 || ERRORS=$((ERRORS+1))
check_file "$MODEL_DIR/duplicate_classifier.joblib" 1000 || ERRORS=$((ERRORS+1))
check_file "$MODEL_DIR/scaler.joblib" 1000 || ERRORS=$((ERRORS+1))

echo ""
if [ $ERRORS -gt 0 ]; then
    echo "❌ $ERRORS file(s) missing! Run: git lfs pull"
    exit 1
fi

echo "✅ Ready! You can now build: docker compose build ai-verification-duplication-service"
