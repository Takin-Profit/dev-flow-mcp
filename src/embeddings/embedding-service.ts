import type { EmbeddingModelInfo, EmbeddingProviderInfo } from "#types"

/**
 * Interface for text embedding services
 */
export type IEmbeddingService = {
  /**
   * Generate embedding vector for text
   *
   * @param text - Text to embed
   * @returns Embedding vector
   */
  generateEmbedding(text: string): Promise<number[]>

  /**
   * Generate embeddings for multiple texts
   *
   * @param texts - Array of texts to embed
   * @returns Array of embedding vectors
   */
  generateEmbeddings(texts: string[]): Promise<number[][]>

  /**
   * Get information about the embedding model
   *
   * @returns Model information
   */
  getModelInfo(): EmbeddingModelInfo

  /**
   * Get information about the embedding provider
   *
   * @returns Provider information
   */
  getProviderInfo(): EmbeddingProviderInfo
}

/**
 * Abstract class for embedding services
 */
export class EmbeddingService implements IEmbeddingService {
  /**
   * Generate embedding vector for text
   *
   * @param text - Text to embed
   * @returns Embedding vector
   */
  generateEmbedding(_text: string): Promise<number[]> {
    throw new Error("Method not implemented")
  }

  /**
   * Generate embeddings for multiple texts
   *
   * @param texts - Array of texts to embed
   * @returns Array of embedding vectors
   */
  generateEmbeddings(_texts: string[]): Promise<number[][]> {
    throw new Error("Method not implemented")
  }

  /**
   * Get information about the embedding model
   *
   * @returns Model information
   */
  getModelInfo(): EmbeddingModelInfo {
    throw new Error("Method not implemented")
  }

  /**
   * Get information about the embedding provider
   *
   * @returns Provider information
   */
  getProviderInfo(): EmbeddingProviderInfo {
    return {
      provider: "default",
      model: this.getModelInfo().name,
      dimensions: this.getModelInfo().dimensions,
    }
  }
}
