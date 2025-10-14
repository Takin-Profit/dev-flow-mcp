/**
 * MCP Server
 * Main Model Context Protocol server initialization and startup logic
 *
 * This module handles:
 * - Storage provider initialization (Neo4j)
 * - Embedding service setup (OpenAI)
 * - Knowledge graph manager creation
 * - MCP server configuration and startup
 *
 * Architecture:
 * The server uses a layered architecture:
 * 1. Storage Layer (Neo4j) - Persists entities, relations, and embeddings
 * 2. Embedding Layer (OpenAI) - Generates vector embeddings for semantic search
 * 3. Knowledge Graph Layer - Manages entities and relations
 * 4. MCP Protocol Layer - Exposes tools via Model Context Protocol
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { initializeStorageProvider } from "#config"
import { KnowledgeGraphManager } from "#knowledge-graph-manager"
import { logger } from "#logger"
import { setupServer } from "#server/setup"

// ============================================================================
// Main Server Initialization
// ============================================================================

/**
 * Start the MCP Server
 *
 * Initializes and starts the Model Context Protocol server with:
 * - Neo4j storage backend
 * - OpenAI embedding service
 * - Knowledge graph management
 * - stdio transport for communication
 *
 * Environment Variables:
 * - DFM_OPENAI_API_KEY: OpenAI API key for embeddings (optional, uses random if missing)
 * - DFM_EMBEDDING_RATE_LIMIT_TOKENS: Rate limit for embedding requests (default: from env config)
 * - DFM_EMBEDDING_RATE_LIMIT_INTERVAL: Rate limit interval in ms (default: from env config)
 * - NEO4J_*: Neo4j connection settings (see config.ts)
 *
 * @throws {Error} If server initialization fails
 */
export default async function startMcpServer(): Promise<void> {
  try {
    logger.info("Starting DevFlow MCP server...")

    // ========================================================================
    // Step 1: Initialize Storage Provider (Neo4j)
    // ========================================================================
    logger.debug("Initializing storage provider...")
    const storageProvider = initializeStorageProvider()

    // ========================================================================
    // Step 2: Create Knowledge Graph Manager
    // ========================================================================
    logger.debug("Creating knowledge graph manager...")
    const knowledgeGraphManager = new KnowledgeGraphManager({
      storageProvider,
      logger,
    })

    // ========================================================================
    // Step 3: Setup and Start MCP Server
    // ========================================================================
    logger.debug("Setting up MCP server...")
    const server = setupServer(knowledgeGraphManager, logger)

    logger.info("Starting MCP server on stdio transport...")
    const transport = new StdioServerTransport()
    await server.connect(transport)

    logger.info("MCP server started successfully")
  } catch (error) {
    logger.error("Failed to start MCP server", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    throw error
  }
}
