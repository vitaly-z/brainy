//! Candle-based sentence embeddings for WASM
//!
//! This crate provides WASM-compatible sentence embeddings using HuggingFace's Candle framework.
//! It supports the all-MiniLM-L6-v2 model for generating 384-dimensional embeddings.
//!
//! ## Features
//! - Model weights embedded at compile time (zero runtime downloads)
//! - Single WASM file contains everything
//! - Works in all environments: Node.js, Bun, Bun compile, browsers
//!
//! ## Usage from JavaScript
//! ```js
//! import init, { EmbeddingEngine } from './candle_embeddings.js';
//!
//! await init();
//! const engine = EmbeddingEngine.create_with_embedded_model();
//!
//! const embedding = engine.embed("Hello world");
//! const embeddings = engine.embed_batch(["Hello", "World"]);
//! ```

use candle_core::{DType, Device, Tensor};
use candle_nn::VarBuilder;
use candle_transformers::models::bert::{BertModel, Config as BertConfig};
use js_sys::{Array, Float32Array};
use tokenizers::Tokenizer;
use wasm_bindgen::prelude::*;

// Model weights are NO LONGER embedded in WASM
//
// Previous design: 90MB WASM with model weights embedded via include_bytes!()
// Problem: WASM parsing/compilation took 139+ seconds on throttled CPU (Cloud Run)
//
// New design: 3MB WASM (inference code only) + external model files
// Model files are loaded at runtime via load() method
// Result: ~5-7 second init instead of 139 seconds
//
// The load() method accepts external model bytes for all environments:
// - Node.js: Load from filesystem
// - Bun: Load from filesystem
// - Bun --compile: Load from embedded assets
// - Browser: Fetch from server

/// Model configuration constants for all-MiniLM-L6-v2
const HIDDEN_SIZE: usize = 384;
const MAX_SEQUENCE_LENGTH: usize = 256;

/// Pooling strategy for aggregating token embeddings
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PoolingStrategy {
    /// Mean pooling over all tokens (default for sentence-transformers)
    Mean,
    /// Use the [CLS] token embedding
    Cls,
}

/// WASM-compatible embedding engine
#[wasm_bindgen]
pub struct EmbeddingEngine {
    model: Option<BertModel>,
    tokenizer: Option<Tokenizer>,
    device: Device,
    pooling: PoolingStrategy,
}

#[wasm_bindgen]
impl EmbeddingEngine {
    /// Create a new embedding engine instance (not loaded)
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        EmbeddingEngine {
            model: None,
            tokenizer: None,
            device: Device::Cpu,
            pooling: PoolingStrategy::Mean,
        }
    }

    /// Load the model and tokenizer from bytes
    ///
    /// This is now the ONLY way to initialize the engine.
    /// Model weights are no longer embedded in WASM for faster initialization.
    ///
    /// # Arguments
    /// * `model_bytes` - SafeTensors format model weights
    /// * `tokenizer_bytes` - tokenizer.json contents
    /// * `config_bytes` - config.json contents
    #[wasm_bindgen]
    pub fn load(
        &mut self,
        model_bytes: &[u8],
        tokenizer_bytes: &[u8],
        config_bytes: &[u8],
    ) -> Result<(), JsValue> {
        // Parse config
        let config: BertConfig = serde_json::from_slice(config_bytes)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse config: {}", e)))?;

        // Load model from SafeTensors
        let tensors = candle_core::safetensors::load_buffer(model_bytes, &self.device)
            .map_err(|e| JsValue::from_str(&format!("Failed to load safetensors: {}", e)))?;

        let vb = VarBuilder::from_tensors(tensors, DType::F32, &self.device);

        let model = BertModel::load(vb, &config)
            .map_err(|e| JsValue::from_str(&format!("Failed to create model: {}", e)))?;

        // Load tokenizer
        let tokenizer = Tokenizer::from_bytes(tokenizer_bytes)
            .map_err(|e| JsValue::from_str(&format!("Failed to load tokenizer: {:?}", e)))?;

        self.model = Some(model);
        self.tokenizer = Some(tokenizer);

        Ok(())
    }

    /// Check if the engine is ready for inference
    #[wasm_bindgen]
    pub fn is_ready(&self) -> bool {
        self.model.is_some() && self.tokenizer.is_some()
    }

    /// Generate embedding for a single text
    ///
    /// Returns a Float32Array of 384 dimensions
    #[wasm_bindgen]
    pub fn embed(&self, text: &str) -> Result<Float32Array, JsValue> {
        let texts = vec![text.to_string()];
        let embeddings = self.embed_internal(&texts)?;

        if let Some(first) = embeddings.into_iter().next() {
            let arr = Float32Array::new_with_length(first.len() as u32);
            arr.copy_from(&first);
            Ok(arr)
        } else {
            Err(JsValue::from_str("No embedding generated"))
        }
    }

    /// Generate embeddings for multiple texts
    ///
    /// Takes a JavaScript Array of strings
    /// Returns a JavaScript Array of Float32Array
    #[wasm_bindgen]
    pub fn embed_batch(&self, texts: &Array) -> Result<Array, JsValue> {
        // Convert JS Array to Vec<String>
        let mut rust_texts: Vec<String> = Vec::with_capacity(texts.length() as usize);
        for i in 0..texts.length() {
            let item = texts.get(i);
            let text = item
                .as_string()
                .ok_or_else(|| JsValue::from_str(&format!("Item at index {} is not a string", i)))?;
            rust_texts.push(text);
        }

        if rust_texts.is_empty() {
            return Ok(Array::new());
        }

        // Get embeddings
        let embeddings = self.embed_internal(&rust_texts)?;

        // Convert to JS Array of Float32Array
        let result = Array::new_with_length(embeddings.len() as u32);
        for (i, embedding) in embeddings.into_iter().enumerate() {
            let arr = Float32Array::new_with_length(embedding.len() as u32);
            arr.copy_from(&embedding);
            result.set(i as u32, arr.into());
        }

        Ok(result)
    }

    /// Internal embedding function that works with Rust types
    fn embed_internal(&self, texts: &[String]) -> Result<Vec<Vec<f32>>, JsValue> {
        let model = self
            .model
            .as_ref()
            .ok_or_else(|| JsValue::from_str("Model not loaded. Call load_embedded() first."))?;
        let tokenizer = self
            .tokenizer
            .as_ref()
            .ok_or_else(|| JsValue::from_str("Tokenizer not loaded. Call load_embedded() first."))?;

        // Tokenize all texts
        let encodings = tokenizer
            .encode_batch(texts.to_vec(), true)
            .map_err(|e| JsValue::from_str(&format!("Tokenization failed: {:?}", e)))?;

        let batch_size = encodings.len();
        if batch_size == 0 {
            return Ok(vec![]);
        }

        // Find max sequence length in batch
        let max_len = encodings
            .iter()
            .map(|e| e.get_ids().len())
            .max()
            .unwrap_or(0)
            .min(MAX_SEQUENCE_LENGTH);

        // Prepare input tensors
        let mut input_ids: Vec<i64> = Vec::with_capacity(batch_size * max_len);
        let mut attention_mask: Vec<i64> = Vec::with_capacity(batch_size * max_len);
        let mut token_type_ids: Vec<i64> = Vec::with_capacity(batch_size * max_len);

        for encoding in &encodings {
            let ids = encoding.get_ids();
            let mask = encoding.get_attention_mask();
            let types = encoding.get_type_ids();

            let seq_len = ids.len().min(max_len);

            // Add tokens
            for i in 0..seq_len {
                input_ids.push(ids[i] as i64);
                attention_mask.push(mask[i] as i64);
                token_type_ids.push(types[i] as i64);
            }

            // Pad to max_len
            for _ in seq_len..max_len {
                input_ids.push(0);
                attention_mask.push(0);
                token_type_ids.push(0);
            }
        }

        // Create tensors
        let input_ids = Tensor::from_vec(input_ids, (batch_size, max_len), &self.device)
            .map_err(|e| JsValue::from_str(&format!("Failed to create input_ids tensor: {}", e)))?;

        let attention_mask_tensor =
            Tensor::from_vec(attention_mask.clone(), (batch_size, max_len), &self.device)
                .map_err(|e| {
                    JsValue::from_str(&format!("Failed to create attention_mask tensor: {}", e))
                })?;

        let token_type_ids = Tensor::from_vec(token_type_ids, (batch_size, max_len), &self.device)
            .map_err(|e| {
                JsValue::from_str(&format!("Failed to create token_type_ids tensor: {}", e))
            })?;

        // Run model inference
        let output = model
            .forward(&input_ids, &token_type_ids, Some(&attention_mask_tensor))
            .map_err(|e| JsValue::from_str(&format!("Model inference failed: {}", e)))?;

        // Apply pooling
        let embeddings = match self.pooling {
            PoolingStrategy::Mean => {
                self.mean_pooling(&output, &attention_mask_tensor, batch_size, max_len)?
            }
            PoolingStrategy::Cls => {
                // Get [CLS] token (first token) embeddings
                output
                    .narrow(1, 0, 1)
                    .map_err(|e| JsValue::from_str(&format!("CLS extraction failed: {}", e)))?
                    .squeeze(1)
                    .map_err(|e| JsValue::from_str(&format!("Squeeze failed: {}", e)))?
            }
        };

        // Normalize embeddings (L2 normalization)
        let embeddings = self.l2_normalize(&embeddings)?;

        // Convert to Vec<Vec<f32>>
        let embeddings_flat = embeddings
            .to_vec2::<f32>()
            .map_err(|e| JsValue::from_str(&format!("Failed to extract embeddings: {}", e)))?;

        Ok(embeddings_flat)
    }

    /// Mean pooling over token embeddings, weighted by attention mask
    fn mean_pooling(
        &self,
        token_embeddings: &Tensor,
        attention_mask: &Tensor,
        batch_size: usize,
        seq_len: usize,
    ) -> Result<Tensor, JsValue> {
        // Expand attention mask to match embedding dimensions
        // attention_mask: [batch, seq] -> [batch, seq, hidden]
        let mask = attention_mask
            .unsqueeze(2)
            .map_err(|e| JsValue::from_str(&format!("Unsqueeze failed: {}", e)))?
            .expand((batch_size, seq_len, HIDDEN_SIZE))
            .map_err(|e| JsValue::from_str(&format!("Expand failed: {}", e)))?
            .to_dtype(DType::F32)
            .map_err(|e| JsValue::from_str(&format!("Dtype conversion failed: {}", e)))?;

        // Multiply embeddings by mask
        let masked = token_embeddings
            .mul(&mask)
            .map_err(|e| JsValue::from_str(&format!("Mask multiplication failed: {}", e)))?;

        // Sum over sequence dimension
        let summed = masked
            .sum(1)
            .map_err(|e| JsValue::from_str(&format!("Sum failed: {}", e)))?;

        // Sum attention mask for normalization
        let mask_sum = mask
            .sum(1)
            .map_err(|e| JsValue::from_str(&format!("Mask sum failed: {}", e)))?
            .clamp(1e-9, f64::INFINITY)
            .map_err(|e| JsValue::from_str(&format!("Clamp failed: {}", e)))?;

        // Divide by mask sum
        summed
            .div(&mask_sum)
            .map_err(|e| JsValue::from_str(&format!("Division failed: {}", e)))
    }

    /// L2 normalize embeddings
    fn l2_normalize(&self, embeddings: &Tensor) -> Result<Tensor, JsValue> {
        let norm = embeddings
            .sqr()
            .map_err(|e| JsValue::from_str(&format!("Sqr failed: {}", e)))?
            .sum_keepdim(1)
            .map_err(|e| JsValue::from_str(&format!("Sum keepdim failed: {}", e)))?
            .sqrt()
            .map_err(|e| JsValue::from_str(&format!("Sqrt failed: {}", e)))?
            .clamp(1e-12, f64::INFINITY)
            .map_err(|e| JsValue::from_str(&format!("Norm clamp failed: {}", e)))?;

        embeddings
            .broadcast_div(&norm)
            .map_err(|e| JsValue::from_str(&format!("Normalize division failed: {}", e)))
    }

    /// Get the embedding dimension (384 for all-MiniLM-L6-v2)
    #[wasm_bindgen]
    pub fn dimension(&self) -> usize {
        HIDDEN_SIZE
    }

    /// Get the maximum sequence length
    #[wasm_bindgen]
    pub fn max_sequence_length(&self) -> usize {
        MAX_SEQUENCE_LENGTH
    }
}

impl Default for EmbeddingEngine {
    fn default() -> Self {
        Self::new()
    }
}

/// Calculate cosine similarity between two embeddings
#[wasm_bindgen]
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }

    let mut dot = 0.0f32;
    let mut norm_a = 0.0f32;
    let mut norm_b = 0.0f32;

    for i in 0..a.len() {
        dot += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }

    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }

    dot / (norm_a.sqrt() * norm_b.sqrt())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cosine_similarity() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![1.0, 0.0, 0.0];
        assert!((cosine_similarity(&a, &b) - 1.0).abs() < 1e-6);

        let c = vec![0.0, 1.0, 0.0];
        assert!(cosine_similarity(&a, &c).abs() < 1e-6);
    }

    #[test]
    fn test_engine_creation() {
        let engine = EmbeddingEngine::new();
        assert!(!engine.is_ready());
        assert_eq!(engine.dimension(), 384);
    }
}
