#!/bin/bash
# Script to ensure AI models are properly downloaded
# Run this after git clone/pull if models are not loading

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODEL_DIR="$SCRIPT_DIR/detector_model_components"

echo "🔍 Checking AI model files..."

# Check if Git LFS is installed
if ! command -v git-lfs &> /dev/null; then
    echo "⚠️  Git LFS is not installed!"
    echo "Please install Git LFS:"
    echo "  macOS: brew install git-lfs"
    echo "  Ubuntu: apt-get install git-lfs"
    echo "  Windows: Download from https://git-lfs.github.io"
    exit 1
fi

# Pull LFS files
echo "📥 Pulling Git LFS files..."
cd "$SCRIPT_DIR/../.."
git lfs pull

# Verify model files exist and are not LFS pointers
echo "✅ Verifying model files..."

check_file() {
    local file="$1"
    local min_size="$2"  # minimum expected size in bytes
    
    if [ ! -f "$file" ]; then
        echo "❌ Missing: $file"
        return 1
    fi
    
    # Check if it's an LFS pointer (small text file starting with "version https://git-lfs")
    if head -c 50 "$file" | grep -q "version https://git-lfs"; then
        echo "❌ LFS pointer not resolved: $file"
        echo "   Run: git lfs pull"
        return 1
    fi
    
    local size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
    if [ "$size" -lt "$min_size" ]; then
        echo "❌ File too small (may be LFS pointer): $file (size: $size bytes)"
        return 1
    fi
    
    echo "✓ OK: $file ($(numfmt --to=iec $size 2>/dev/null || echo "$size bytes"))"
    return 0
}

ERRORS=0

# BERT model should be ~400MB+
check_file "$MODEL_DIR/bert_model_finetuned.pth" 100000000 || ERRORS=$((ERRORS+1))

# Fake detector head ~1MB
check_file "$MODEL_DIR/fake_detector_head.pth" 100000 || ERRORS=$((ERRORS+1))

# Joblib files ~1KB-1MB
check_file "$MODEL_DIR/duplicate_classifier.joblib" 1000 || ERRORS=$((ERRORS+1))
check_file "$MODEL_DIR/scaler.joblib" 1000 || ERRORS=$((ERRORS+1))

if [ $ERRORS -gt 0 ]; then
    echo ""
    echo "❌ $ERRORS model file(s) have issues!"
    echo ""
    echo "Try running:"
    echo "  git lfs install"
    echo "  git lfs pull"
    exit 1
fi

echo ""
echo "✅ All model files are ready!"
