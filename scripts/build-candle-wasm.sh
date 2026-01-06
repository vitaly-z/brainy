#!/bin/bash
# Build script for Candle WASM embedding engine
#
# Requirements:
# - Rust toolchain (rustup)
# - wasm-pack (cargo install wasm-pack)
# - Build tools (build-essential on Ubuntu/Debian)
#
# Usage:
#   ./scripts/build-candle-wasm.sh
#   ./scripts/build-candle-wasm.sh --release

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CANDLE_DIR="$PROJECT_ROOT/src/embeddings/candle-wasm"
OUTPUT_DIR="$PROJECT_ROOT/src/embeddings/wasm/pkg"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Building Candle WASM embedding engine...${NC}"

# Check prerequisites
check_prerequisites() {
    local missing=()

    if ! command -v rustc &> /dev/null; then
        missing+=("rust (install via: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh)")
    fi

    if ! command -v wasm-pack &> /dev/null; then
        missing+=("wasm-pack (install via: cargo install wasm-pack)")
    fi

    if ! command -v cc &> /dev/null && ! command -v gcc &> /dev/null; then
        missing+=("C compiler (install via: sudo apt-get install build-essential)")
    fi

    if [ ${#missing[@]} -gt 0 ]; then
        echo -e "${RED}Missing prerequisites:${NC}"
        for prereq in "${missing[@]}"; do
            echo "  - $prereq"
        done
        exit 1
    fi

    echo -e "${GREEN}All prerequisites found.${NC}"
}

# Download model files if not present
download_model() {
    local MODEL_DIR="$PROJECT_ROOT/assets/models/all-MiniLM-L6-v2"
    local SAFETENSORS="$MODEL_DIR/model.safetensors"
    local TOKENIZER="$MODEL_DIR/tokenizer.json"
    local CONFIG="$MODEL_DIR/config.json"

    if [ -f "$SAFETENSORS" ] && [ -f "$TOKENIZER" ] && [ -f "$CONFIG" ]; then
        echo -e "${GREEN}Model files already present.${NC}"
        return
    fi

    echo -e "${YELLOW}Downloading model files...${NC}"
    mkdir -p "$MODEL_DIR"

    # Download from HuggingFace Hub
    local HF_URL="https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main"

    if [ ! -f "$SAFETENSORS" ]; then
        curl -L "$HF_URL/model.safetensors" -o "$SAFETENSORS"
    fi

    if [ ! -f "$TOKENIZER" ]; then
        curl -L "$HF_URL/tokenizer.json" -o "$TOKENIZER"
    fi

    if [ ! -f "$CONFIG" ]; then
        curl -L "$HF_URL/config.json" -o "$CONFIG"
    fi

    echo -e "${GREEN}Model files downloaded.${NC}"
}

# Build WASM
build_wasm() {
    local BUILD_MODE="${1:-release}"

    echo -e "${GREEN}Building WASM (${BUILD_MODE})...${NC}"
    cd "$CANDLE_DIR"

    if [ "$BUILD_MODE" = "release" ]; then
        wasm-pack build --target web --release --out-dir "$OUTPUT_DIR"
    else
        wasm-pack build --target web --dev --out-dir "$OUTPUT_DIR"
    fi

    echo -e "${GREEN}WASM build complete. Output: $OUTPUT_DIR${NC}"
}

# Main
main() {
    local mode="release"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --dev|--debug)
                mode="dev"
                shift
                ;;
            --release)
                mode="release"
                shift
                ;;
            *)
                echo "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    check_prerequisites
    download_model
    build_wasm "$mode"

    echo -e "${GREEN}Done! WASM package ready at: $OUTPUT_DIR${NC}"
}

main "$@"
