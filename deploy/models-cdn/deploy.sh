#!/bin/bash

# Deploy Brainy Models to CDN
# This script uploads the CRITICAL transformer models to our CDN

set -e

echo "🧠 Brainy Models CDN Deployment"
echo "================================"
echo "⚠️  CRITICAL: These models MUST NEVER CHANGE"
echo ""

# Configuration
MODELS_DIR="../../models"
R2_BUCKET="brainy-models"
CDN_URL="https://models.soulcraft.com"

# Check if models exist locally
if [ ! -d "$MODELS_DIR/Xenova/all-MiniLM-L6-v2" ]; then
  echo "❌ Models not found locally. Run 'npm run download-models' first."
  exit 1
fi

# Calculate SHA256 hashes
echo "🔐 Calculating SHA256 hashes..."
MODEL_HASH=$(sha256sum $MODELS_DIR/Xenova/all-MiniLM-L6-v2/onnx/model.onnx | cut -d' ' -f1)
TOKENIZER_HASH=$(sha256sum $MODELS_DIR/Xenova/all-MiniLM-L6-v2/tokenizer.json | cut -d' ' -f1)
CONFIG_HASH=$(sha256sum $MODELS_DIR/Xenova/all-MiniLM-L6-v2/config.json | cut -d' ' -f1)

echo "   model.onnx: $MODEL_HASH"
echo "   tokenizer.json: $TOKENIZER_HASH"
echo "   config.json: $CONFIG_HASH"

# Create tarball
echo "📦 Creating model tarball..."
cd $MODELS_DIR
tar -czf all-MiniLM-L6-v2.tar.gz Xenova/all-MiniLM-L6-v2/
TARBALL_HASH=$(sha256sum all-MiniLM-L6-v2.tar.gz | cut -d' ' -f1)
echo "   Tarball SHA256: $TARBALL_HASH"
cd -

# Upload to R2
echo "☁️  Uploading to Cloudflare R2..."

# Upload individual files
wrangler r2 object put $R2_BUCKET/models/Xenova/all-MiniLM-L6-v2/onnx/model.onnx \
  --file=$MODELS_DIR/Xenova/all-MiniLM-L6-v2/onnx/model.onnx \
  --content-type="application/octet-stream"

wrangler r2 object put $R2_BUCKET/models/Xenova/all-MiniLM-L6-v2/tokenizer.json \
  --file=$MODELS_DIR/Xenova/all-MiniLM-L6-v2/tokenizer.json \
  --content-type="application/json"

wrangler r2 object put $R2_BUCKET/models/Xenova/all-MiniLM-L6-v2/config.json \
  --file=$MODELS_DIR/Xenova/all-MiniLM-L6-v2/config.json \
  --content-type="application/json"

wrangler r2 object put $R2_BUCKET/models/Xenova/all-MiniLM-L6-v2/tokenizer_config.json \
  --file=$MODELS_DIR/Xenova/all-MiniLM-L6-v2/tokenizer_config.json \
  --content-type="application/json"

# Upload tarball
wrangler r2 object put $R2_BUCKET/tarballs/all-MiniLM-L6-v2.tar.gz \
  --file=$MODELS_DIR/all-MiniLM-L6-v2.tar.gz \
  --content-type="application/gzip"

# Deploy Worker
echo "🚀 Deploying Cloudflare Worker..."
wrangler deploy

# Create immutable backup
echo "💾 Creating immutable backup..."
BACKUP_NAME="models-backup-$(date +%Y%m%d)-$MODEL_HASH.tar.gz"
cp $MODELS_DIR/all-MiniLM-L6-v2.tar.gz $BACKUP_NAME

# Save hashes for verification
cat > model-hashes.json <<EOF
{
  "version": "1.0.0",
  "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "hashes": {
    "model.onnx": "$MODEL_HASH",
    "tokenizer.json": "$TOKENIZER_HASH",
    "config.json": "$CONFIG_HASH",
    "tarball": "$TARBALL_HASH"
  },
  "cdn": "$CDN_URL",
  "backup": "$BACKUP_NAME"
}
EOF

echo "✅ Deployment complete!"
echo ""
echo "📍 CDN URL: $CDN_URL/brainy/v1/all-MiniLM-L6-v2.tar.gz"
echo "🔒 Hashes saved to: model-hashes.json"
echo "💾 Backup saved as: $BACKUP_NAME"
echo ""
echo "⚠️  CRITICAL REMINDER:"
echo "   These models are now immutable and cached globally."
echo "   They MUST NEVER be changed or users will lose access to their data."
echo ""
echo "To verify deployment:"
echo "  curl -I $CDN_URL/brainy/v1/all-MiniLM-L6-v2.tar.gz"