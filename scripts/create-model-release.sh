#!/bin/bash

# Create GitHub Release with Model Assets
# This creates an IMMUTABLE release that serves as a permanent backup

set -e

echo "🧠 Creating GitHub Release with Model Assets"
echo "============================================"

# Configuration
VERSION="models-v1.0.0"
MODELS_DIR="./models"
REPO="soulcraftlabs/brainy-models"

# Check if models exist
if [ ! -d "$MODELS_DIR/Xenova/all-MiniLM-L6-v2" ]; then
  echo "❌ Models not found. Run 'npm run download-models' first."
  exit 1
fi

# Create tarball
echo "📦 Creating model archive..."
cd $MODELS_DIR
tar -czf ../all-MiniLM-L6-v2.tar.gz Xenova/all-MiniLM-L6-v2/
cd ..

# Calculate hashes
echo "🔐 Calculating SHA256 hash..."
HASH=$(sha256sum all-MiniLM-L6-v2.tar.gz | cut -d' ' -f1)
SIZE=$(stat -c%s all-MiniLM-L6-v2.tar.gz 2>/dev/null || stat -f%z all-MiniLM-L6-v2.tar.gz)
SIZE_MB=$((SIZE / 1048576))

echo "   File: all-MiniLM-L6-v2.tar.gz"
echo "   Size: ${SIZE_MB}MB"
echo "   SHA256: $HASH"

# Create release notes
cat > release-notes.md <<EOF
# Brainy Transformer Models v1.0.0

## ⚠️ CRITICAL: IMMUTABLE RELEASE

This release contains the transformer models required for Brainy operations.
**These models MUST NEVER change** as they are the foundation of user data access.

## Model: all-MiniLM-L6-v2

- **Purpose**: Generates 384-dimensional embeddings for vector search
- **Size**: ${SIZE_MB}MB compressed
- **SHA256**: \`${HASH}\`
- **Files**:
  - \`onnx/model.onnx\` - ONNX model (87MB)
  - \`tokenizer.json\` - Tokenizer configuration (695KB)
  - \`config.json\` - Model configuration (650B)
  - \`tokenizer_config.json\` - Tokenizer settings (366B)

## Usage

### Automatic Download (Runtime)
Models download automatically when using Brainy:
\`\`\`javascript
import { BrainyData } from '@soulcraft/brainy'
const brainy = new BrainyData()
await brainy.init() // Models download here if needed
\`\`\`

### Pre-download for Deployment
\`\`\`bash
# During Docker build or CI
npm install @soulcraft/brainy
npm run download-models
\`\`\`

### Direct Download
\`\`\`bash
# From this release
curl -L https://github.com/${REPO}/releases/download/${VERSION}/all-MiniLM-L6-v2.tar.gz -o models.tar.gz
tar -xzf models.tar.gz

# Verify integrity
echo "${HASH}  models.tar.gz" | sha256sum -c
\`\`\`

## Fallback Sources

Brainy will try these sources in order:
1. **GitHub Release**: \`https://github.com/${REPO}/releases/download/${VERSION}/all-MiniLM-L6-v2.tar.gz\`
2. **Soulcraft CDN**: \`https://models.soulcraft.com/brainy/v1/all-MiniLM-L6-v2.tar.gz\`
3. **Hugging Face**: Original source (automatic)

## Verification

Always verify the SHA256 hash:
\`\`\`bash
echo "${HASH}  all-MiniLM-L6-v2.tar.gz" | sha256sum -c
\`\`\`

## License

These models are from Hugging Face and are subject to their respective licenses.
The all-MiniLM-L6-v2 model is Apache 2.0 licensed.

---

**⚠️ DO NOT MODIFY THIS RELEASE**
Changing these models would break existing user data.
EOF

# Create the release
echo "🚀 Creating GitHub release..."

# First, create the repository if it doesn't exist
gh repo create $REPO --public --description "Immutable transformer models for Brainy" 2>/dev/null || true

# Create the release with the model as an asset
gh release create $VERSION \
  --repo $REPO \
  --title "Brainy Models v1.0.0 - IMMUTABLE" \
  --notes-file release-notes.md \
  --verify-tag \
  all-MiniLM-L6-v2.tar.gz

echo "✅ Release created successfully!"
echo ""
echo "📍 Release URL: https://github.com/${REPO}/releases/tag/${VERSION}"
echo "📦 Download URL: https://github.com/${REPO}/releases/download/${VERSION}/all-MiniLM-L6-v2.tar.gz"
echo "🔒 SHA256: $HASH"
echo ""
echo "This release is now immutable and will serve as a permanent backup."
echo "The download URL can be used in the Brainy fallback chain."

# Update our model manager with the correct URL
echo ""
echo "To update Brainy with this URL, add to src/critical/model-guardian.ts:"
echo "  url: 'https://github.com/${REPO}/releases/download/${VERSION}/all-MiniLM-L6-v2.tar.gz'"

# Clean up
rm all-MiniLM-L6-v2.tar.gz
rm release-notes.md