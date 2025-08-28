#!/bin/bash
# Setup GitHub branch with extracted model files for direct serving
# This creates a 'models' branch with uncompressed files that transformers.js can use directly

set -e

echo "🚀 Setting up GitHub models branch for reliable model serving..."

# Create a temporary directory for our work
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

echo "📥 Downloading model tar.gz from release..."
curl -sL https://github.com/soulcraftlabs/brainy/releases/download/models-v1/all-MiniLM-L6-v2.tar.gz -o models.tar.gz

echo "📦 Extracting models..."
tar -xzf models.tar.gz

echo "🔧 Setting up models branch..."
git clone https://github.com/soulcraftlabs/brainy.git --depth 1 -b main repo
cd repo

# Create orphan branch for models (no history needed)
git checkout --orphan models
git rm -rf . 2>/dev/null || true

# Create the proper directory structure for transformers.js
mkdir -p Xenova/all-MiniLM-L6-v2/onnx

# Copy model files with correct structure
cp ../all-MiniLM-L6-v2/config.json Xenova/all-MiniLM-L6-v2/
cp ../all-MiniLM-L6-v2/tokenizer.json Xenova/all-MiniLM-L6-v2/
cp ../all-MiniLM-L6-v2/tokenizer_config.json Xenova/all-MiniLM-L6-v2/
cp ../all-MiniLM-L6-v2/onnx/model.onnx Xenova/all-MiniLM-L6-v2/onnx/
cp ../all-MiniLM-L6-v2/onnx/model_quantized.onnx Xenova/all-MiniLM-L6-v2/onnx/ 2>/dev/null || true

# Add README explaining this branch
cat > README.md << 'EOF'
# Brainy Model Files

This branch contains extracted model files for direct serving via raw.githubusercontent.com

## Structure
```
Xenova/
  all-MiniLM-L6-v2/
    config.json
    tokenizer.json
    tokenizer_config.json
    onnx/
      model.onnx
      model_quantized.onnx
```

## Usage
These files are automatically loaded by Brainy when models are needed.
The URL pattern is:
`https://raw.githubusercontent.com/soulcraftlabs/brainy/models/Xenova/all-MiniLM-L6-v2/{file}`

## DO NOT EDIT
This branch is managed automatically. Do not edit files directly.
EOF

# Create .gitattributes for LFS if needed (for large model files)
cat > .gitattributes << 'EOF'
*.onnx filter=lfs diff=lfs merge=lfs -text
*.bin filter=lfs diff=lfs merge=lfs -text
*.safetensors filter=lfs diff=lfs merge=lfs -text
EOF

echo "📝 Creating commit..."
git add .
git commit -m "feat: extracted model files for direct GitHub serving

- Xenova/all-MiniLM-L6-v2 model files
- Proper directory structure for transformers.js
- Direct serving via raw.githubusercontent.com"

echo "✅ Models branch ready!"
echo ""
echo "To push this branch to GitHub, run:"
echo "  cd $TEMP_DIR/repo"
echo "  git push origin models"
echo ""
echo "Once pushed, models will be available at:"
echo "  https://raw.githubusercontent.com/soulcraftlabs/brainy/models/Xenova/all-MiniLM-L6-v2/config.json"
echo "  https://raw.githubusercontent.com/soulcraftlabs/brainy/models/Xenova/all-MiniLM-L6-v2/tokenizer.json"
echo "  etc..."