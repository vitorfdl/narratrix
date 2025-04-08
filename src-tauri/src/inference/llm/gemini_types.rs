use std::pin::Pin;

/// Gemini types (Generally user defined types) for Gemini API
use async_openai::{
    error::OpenAIError,
    types::{ChatChoice, ChatChoiceStream, CompletionUsage, Image},
};
use futures::Stream;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Clone, PartialEq, Serialize)]
/// Represents a streamed chunk of a chat completion response returned by model, based on the provided input.
pub struct GeminiCreateChatCompletionStreamResponse {
    /// A list of chat completion choices. Can contain more than one elements if `n` is greater than 1. Can also be empty for the last chunk if you set `stream_options: {"include_usage": true}`.
    pub choices: Vec<ChatChoiceStream>,

    /// The Unix timestamp (in seconds) of when the chat completion was created. Each chunk has the same timestamp.
    pub created: u32,
    /// The model to generate the completion.
    pub model: String,

    /// The object type, which is always `chat.completion.chunk`.
    pub object: String,

    /// An optional field that will only be present when you set `stream_options: {"include_usage": true}` in your request.
    /// When present, it contains a null value except for the last chunk which contains the token usage statistics for the entire request.
    pub usage: Option<CompletionUsage>,
}

/// A stream of chat completion responses.
pub type GeminiChatCompletionResponseStream = Pin<
    Box<dyn Stream<Item = Result<GeminiCreateChatCompletionStreamResponse, OpenAIError>> + Send>,
>;

/// Represents a chat completion response returned by model, based on the provided input.
#[derive(Debug, Deserialize, Clone, PartialEq, Serialize)]
pub struct GeminiCreateChatCompletionResponse {
    /// A list of chat completion choices. Can be more than one if `n` is greater than 1.
    pub choices: Vec<ChatChoice>,
    /// The Unix timestamp (in seconds) of when the chat completion was created.
    pub created: u32,
    /// The model used for the chat completion.
    pub model: String,
    /// The object type, which is always `chat.completion`.
    pub object: String,
    /// usage statistics for the entire request.
    pub usage: Option<CompletionUsage>,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq)]
pub struct GeminiImagesResponse {
    pub data: Vec<std::sync::Arc<Image>>,
}

/// Represents an embedding vector returned by embedding endpoint.
#[derive(Debug, Deserialize, Serialize, Clone, PartialEq)]
pub struct GeminiEmbedding {
    /// The object type, which is always "embedding".
    pub object: String,
    /// The embedding vector, which is a list of floats. The length of vector
    pub embedding: Vec<f32>,
}

#[derive(Debug, Deserialize, Clone, PartialEq, Serialize)]
pub struct GeminiCreateEmbeddingResponse {
    pub object: String,
    /// The name of the model used to generate the embedding.
    pub model: String,
    /// The list of embeddings generated by the model.
    pub data: Vec<GeminiEmbedding>,
}
