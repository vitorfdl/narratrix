use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use tiktoken_rs::cl100k_base;
use tokenizers::tokenizer::Tokenizer;

// Supported model types
#[derive(Debug, Deserialize, Serialize, Clone)]
pub enum ModelType {
    Llama2,
    Llama3,
    Deepseek,
    Mistral,
    DEFAULT,
}

// Response with token count
#[derive(Debug, Serialize)]
pub struct TokenCountResponse {
    pub count: usize,
    pub model: String,
}

// Cache for HuggingFace tokenizers
static LLAMA_TOKENIZER: OnceLock<Tokenizer> = OnceLock::new();
static MISTRAL_TOKENIZER: OnceLock<Tokenizer> = OnceLock::new();

// Initialize tokenizers lazily
fn get_llama_tokenizer() -> &'static Tokenizer {
    LLAMA_TOKENIZER
        .get_or_init(|| Tokenizer::from_pretrained("meta-llama/Llama-2-7b-chat-hf", None).unwrap())
}

fn get_mistral_tokenizer() -> &'static Tokenizer {
    MISTRAL_TOKENIZER.get_or_init(|| {
        Tokenizer::from_pretrained("mistralai/Mistral-7B-Instruct-v0.1", None).unwrap()
    })
}

// Main token counting function exposed to Tauri
#[tauri::command]
pub async fn count_tokens(
    text: String,
    model_type: ModelType,
) -> Result<TokenCountResponse, String> {
    let count = match count_tokens_for_model(&text, &model_type) {
        Ok(count) => count,
        Err(e) => return Err(format!("Failed to count tokens: {}", e)),
    };

    Ok(TokenCountResponse {
        count,
        model: format!("{:?}", model_type),
    })
}

// Internal function to handle different tokenization methods
fn count_tokens_for_model(text: &str, model_type: &ModelType) -> Result<usize> {
    match model_type {
        // Llama models
        ModelType::Llama2 | ModelType::Llama3 => {
            let tokenizer = get_llama_tokenizer();
            let encoding = tokenizer
                .encode(text, false)
                .map_err(|e| anyhow!("Llama tokenization failed: {}", e))?;
            Ok(encoding.get_ids().len())
        }

        // Mistral & Deepseek
        ModelType::Mistral | ModelType::Deepseek => {
            // Similar tokenization to Llama for Mistral
            let tokenizer = get_mistral_tokenizer();
            let encoding = tokenizer
                .encode(text, false)
                .map_err(|e| anyhow!("Mistral tokenization failed: {}", e))?;
            Ok(encoding.get_ids().len())
        }

        _ => {
            // Claude typically uses ~1 token per 4 characters of text as an approximation
            // For higher accuracy, we'd use Anthropic's tokenizer
            let tiktoken_bpe = cl100k_base()?; // Use OpenAI as approximate fallback
            Ok(tiktoken_bpe.encode_ordinary(text).len())
        }
    }
}
