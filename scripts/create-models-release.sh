#!/bin/bash
# Create GitHub release with unarchived model files for direct serving
# This allows transformers.js to download individual files directly

set -e

echo "🚀 Creating GitHub release with unarchived model files..."

# Create temporary directory
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

echo "📥 Downloading existing model archive..."
curl -sL https://github.com/soulcraftlabs/brainy/releases/download/models-v1/all-MiniLM-L6-v2.tar.gz -o models.tar.gz

echo "📦 Extracting models..."
tar -xzf models.tar.gz

echo "🔧 Preparing individual model files for release..."

# Create properly structured directory
mkdir -p release-files/Xenova/all-MiniLM-L6-v2/onnx

# Copy files with correct naming for direct serving
cp all-MiniLM-L6-v2/config.json release-files/Xenova/all-MiniLM-L6-v2/
cp all-MiniLM-L6-v2/tokenizer.json release-files/Xenova/all-MiniLM-L6-v2/
cp all-MiniLM-L6-v2/tokenizer_config.json release-files/Xenova/all-MiniLM-L6-v2/
cp all-MiniLM-L6-v2/onnx/model.onnx release-files/Xenova/all-MiniLM-L6-v2/onnx/

# Also keep the tar.gz for backward compatibility
cp models.tar.gz release-files/

echo "📋 Files to upload:"
find release-files -type f -exec ls -lh {} \;

echo ""
echo "✅ Files ready for release!"
echo ""
echo "To create the release with individual files:"
echo ""
echo "1. Go to: https://github.com/soulcraftlabs/brainy/releases/new"
echo "2. Tag: models-v2"
echo "3. Title: Model Files v2 - Unarchived"
echo "4. Upload these files from $TEMP_DIR/release-files/:"
echo "   - Xenova/all-MiniLM-L6-v2/config.json"
echo "   - Xenova/all-MiniLM-L6-v2/tokenizer.json"
echo "   - Xenova/all-MiniLM-L6-v2/tokenizer_config.json"
echo "   - Xenova/all-MiniLM-L6-v2/onnx/model.onnx"
echo "   - all-MiniLM-L6-v2.tar.gz (for compatibility)"
echo ""
echo "Or use GitHub CLI:"
echo "  cd $TEMP_DIR/release-files"
echo "  gh release create models-v2 --repo soulcraftlabs/brainy \\"
echo "    --title 'Model Files v2 - Direct Serving' \\"
echo "    --notes 'Unarchived model files for direct HTTP serving' \\"
echo "    Xenova/all-MiniLM-L6-v2/config.json \\"
echo "    Xenova/all-MiniLM-L6-v2/tokenizer.json \\"
echo "    Xenova/all-MiniLM-L6-v2/tokenizer_config.json \\"
echo "    Xenova/all-MiniLM-L6-v2/onnx/model.onnx \\"
echo "    models.tar.gz"