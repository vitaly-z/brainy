#!/bin/bash

# Setup Google Cloud Storage for Brainy Models CDN
# This creates an immutable model hosting solution at models.soulcraft.com

set -e

echo "🧠 Setting up Brainy Models CDN on Google Cloud Storage"
echo "========================================================"

# Configuration
PROJECT_ID="soulcraft-brain"
BUCKET_NAME="models.soulcraft.com"
MODELS_DIR="../../models"
DOMAIN="models.soulcraft.com"

# Check if models exist locally
if [ ! -d "$MODELS_DIR/Xenova/all-MiniLM-L6-v2" ]; then
  echo "❌ Models not found. Run 'npm run download-models' first."
  exit 1
fi

# Set the project
echo "📍 Setting project: $PROJECT_ID"
gcloud config set project $PROJECT_ID

# Create the bucket (if it doesn't exist)
echo "🪣 Creating GCS bucket: $BUCKET_NAME"
gsutil mb -p $PROJECT_ID -c STANDARD -l US -b on gs://$BUCKET_NAME 2>/dev/null || echo "Bucket already exists"

# Enable public access
echo "🌍 Enabling public access..."
gsutil iam ch allUsers:objectViewer gs://$BUCKET_NAME

# Set CORS policy for browser access
echo "🔧 Setting CORS policy..."
cat > cors.json <<EOF
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type", "Content-Length", "X-Model-Version", "X-Model-SHA256"],
    "maxAgeSeconds": 31536000
  }
]
EOF
gsutil cors set cors.json gs://$BUCKET_NAME

# Calculate SHA256 hashes
echo "🔐 Calculating SHA256 hashes..."
MODEL_HASH=$(sha256sum $MODELS_DIR/Xenova/all-MiniLM-L6-v2/onnx/model.onnx | cut -d' ' -f1)
TOKENIZER_HASH=$(sha256sum $MODELS_DIR/Xenova/all-MiniLM-L6-v2/tokenizer.json | cut -d' ' -f1)
CONFIG_HASH=$(sha256sum $MODELS_DIR/Xenova/all-MiniLM-L6-v2/config.json | cut -d' ' -f1)

echo "   model.onnx: $MODEL_HASH"
echo "   tokenizer.json: $TOKENIZER_HASH"
echo "   config.json: $CONFIG_HASH"

# Create tarball
echo "📦 Creating model package..."
cd $MODELS_DIR
tar -czf all-MiniLM-L6-v2.tar.gz Xenova/all-MiniLM-L6-v2/
TARBALL_HASH=$(sha256sum all-MiniLM-L6-v2.tar.gz | cut -d' ' -f1)
cd -

# Upload model files with cache headers
echo "☁️ Uploading models to GCS..."

# Upload individual files
gsutil -h "Cache-Control:public, max-age=31536000, immutable" \
       -h "Content-Type:application/octet-stream" \
       cp $MODELS_DIR/Xenova/all-MiniLM-L6-v2/onnx/model.onnx \
       gs://$BUCKET_NAME/models/Xenova/all-MiniLM-L6-v2/onnx/model.onnx

gsutil -h "Cache-Control:public, max-age=31536000, immutable" \
       -h "Content-Type:application/json" \
       cp $MODELS_DIR/Xenova/all-MiniLM-L6-v2/tokenizer.json \
       gs://$BUCKET_NAME/models/Xenova/all-MiniLM-L6-v2/tokenizer.json

gsutil -h "Cache-Control:public, max-age=31536000, immutable" \
       -h "Content-Type:application/json" \
       cp $MODELS_DIR/Xenova/all-MiniLM-L6-v2/config.json \
       gs://$BUCKET_NAME/models/Xenova/all-MiniLM-L6-v2/config.json

gsutil -h "Cache-Control:public, max-age=31536000, immutable" \
       -h "Content-Type:application/json" \
       cp $MODELS_DIR/Xenova/all-MiniLM-L6-v2/tokenizer_config.json \
       gs://$BUCKET_NAME/models/Xenova/all-MiniLM-L6-v2/tokenizer_config.json

# Upload tarball
gsutil -h "Cache-Control:public, max-age=31536000, immutable" \
       -h "Content-Type:application/gzip" \
       cp $MODELS_DIR/all-MiniLM-L6-v2.tar.gz \
       gs://$BUCKET_NAME/models/all-MiniLM-L6-v2.tar.gz

# Create and upload manifest
echo "📝 Creating manifest..."
cat > manifest.json <<EOF
{
  "version": "1.0.0",
  "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "models": {
    "all-MiniLM-L6-v2": {
      "version": "1.0.0",
      "dimensions": 384,
      "sha256": "$TARBALL_HASH",
      "files": {
        "model.onnx": {
          "size": 90555481,
          "sha256": "$MODEL_HASH",
          "path": "models/Xenova/all-MiniLM-L6-v2/onnx/model.onnx"
        },
        "tokenizer.json": {
          "size": 711661,
          "sha256": "$TOKENIZER_HASH",
          "path": "models/Xenova/all-MiniLM-L6-v2/tokenizer.json"
        },
        "config.json": {
          "size": 650,
          "sha256": "$CONFIG_HASH",
          "path": "models/Xenova/all-MiniLM-L6-v2/config.json"
        }
      },
      "download": {
        "tarball": "https://$DOMAIN/models/all-MiniLM-L6-v2.tar.gz",
        "github": "https://github.com/soulcraftlabs/brainy-models/releases/download/v1.0.0/all-MiniLM-L6-v2.tar.gz"
      }
    }
  }
}
EOF

gsutil -h "Cache-Control:public, max-age=3600" \
       -h "Content-Type:application/json" \
       cp manifest.json gs://$BUCKET_NAME/models/manifest.json

# Create and upload index.html
echo "🎨 Creating index page..."
cat > index.html <<EOF
<!DOCTYPE html>
<html>
<head>
    <title>Brainy Models CDN - Soulcraft</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 900px;
            margin: 50px auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            background: white;
            border-radius: 10px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 { 
            color: #333;
            margin-top: 0;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .status {
            background: #10b981;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: bold;
        }
        .critical {
            background: #fef2f2;
            border-left: 4px solid #ef4444;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
        }
        .download-box {
            background: #f0fdf4;
            border: 1px solid #10b981;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .hash {
            font-family: monospace;
            background: #f3f4f6;
            padding: 8px;
            border-radius: 4px;
            font-size: 12px;
            word-break: break-all;
            display: inline-block;
            margin-top: 5px;
        }
        code {
            background: #f3f4f6;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: monospace;
        }
        pre {
            background: #1f2937;
            color: #e5e7eb;
            padding: 15px;
            border-radius: 8px;
            overflow-x: auto;
        }
        a {
            color: #667eea;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        .file-list {
            background: #f9fafb;
            padding: 15px;
            border-radius: 8px;
            margin: 10px 0;
        }
        .file-list li {
            margin: 8px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧠 Brainy Models CDN <span class="status">ACTIVE</span></h1>
        
        <div class="critical">
            <strong>⚠️ CRITICAL:</strong> These models MUST NEVER CHANGE<br>
            <small>They are the foundation of user data access. Any change would break existing embeddings and make user data inaccessible.</small>
        </div>

        <h2>Transformer Model: all-MiniLM-L6-v2</h2>
        <p>This 384-dimensional transformer model is essential for Brainy's vector operations.</p>
        
        <div class="download-box">
            <h3>📦 Complete Package</h3>
            <p>
                <strong><a href="/models/all-MiniLM-L6-v2.tar.gz">all-MiniLM-L6-v2.tar.gz</a></strong> (87MB)<br>
                <span class="hash">SHA256: $TARBALL_HASH</span>
            </p>
        </div>

        <h3>Individual Files:</h3>
        <div class="file-list">
            <ul>
                <li>
                    <a href="/models/Xenova/all-MiniLM-L6-v2/onnx/model.onnx">model.onnx</a> - ONNX Runtime model (87MB)<br>
                    <span class="hash">$MODEL_HASH</span>
                </li>
                <li>
                    <a href="/models/Xenova/all-MiniLM-L6-v2/tokenizer.json">tokenizer.json</a> - Tokenizer configuration (695KB)<br>
                    <span class="hash">$TOKENIZER_HASH</span>
                </li>
                <li>
                    <a href="/models/Xenova/all-MiniLM-L6-v2/config.json">config.json</a> - Model configuration (650B)<br>
                    <span class="hash">$CONFIG_HASH</span>
                </li>
            </ul>
        </div>

        <h3>Integration:</h3>
        <pre><code># Download and verify
curl -O https://models.soulcraft.com/models/all-MiniLM-L6-v2.tar.gz
echo "$TARBALL_HASH  all-MiniLM-L6-v2.tar.gz" | sha256sum -c

# Extract
tar -xzf all-MiniLM-L6-v2.tar.gz</code></pre>

        <h3>API Endpoints:</h3>
        <ul>
            <li><code>GET /models/manifest.json</code> - Model manifest with all hashes</li>
            <li><code>GET /models/all-MiniLM-L6-v2.tar.gz</code> - Complete model package</li>
            <li><code>GET /models/Xenova/all-MiniLM-L6-v2/*</code> - Individual model files</li>
        </ul>

        <h3>Features:</h3>
        <ul>
            <li>✅ Immutable content (1-year cache headers)</li>
            <li>✅ SHA256 verification for integrity</li>
            <li>✅ Global CDN via Google Cloud</li>
            <li>✅ CORS enabled for browser access</li>
            <li>✅ 99.95% uptime SLA</li>
        </ul>

        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        
        <p style="text-align: center; color: #6b7280; font-size: 14px;">
            Powered by Google Cloud Storage | 
            <a href="/models/manifest.json">View Manifest</a> | 
            <a href="https://github.com/soulcraftlabs/brainy">GitHub</a>
        </p>
    </div>
</body>
</html>
EOF

gsutil -h "Cache-Control:public, max-age=3600" \
       -h "Content-Type:text/html" \
       cp index.html gs://$BUCKET_NAME/index.html

# Set up website configuration
echo "🌐 Configuring website settings..."
gsutil web set -m index.html -e 404.html gs://$BUCKET_NAME

# Create a load balancer (optional - for custom domain)
echo ""
echo "✅ GCS CDN setup complete!"
echo ""
echo "📍 Access your models at:"
echo "   https://storage.googleapis.com/$BUCKET_NAME/index.html"
echo "   https://storage.googleapis.com/$BUCKET_NAME/models/all-MiniLM-L6-v2.tar.gz"
echo ""
echo "To point models.soulcraft.com to this bucket:"
echo "1. Add a CNAME record: models.soulcraft.com -> c.storage.googleapis.com"
echo "2. Verify domain ownership in Google Cloud Console"
echo "3. The bucket name must match the domain (models.soulcraft.com)"
echo ""
echo "Model hashes:"
echo "  Tarball: $TARBALL_HASH"
echo "  Model: $MODEL_HASH"
echo ""
echo "⚠️ Remember: These models must NEVER change!"

# Cleanup
rm cors.json manifest.json index.html
rm $MODELS_DIR/all-MiniLM-L6-v2.tar.gz