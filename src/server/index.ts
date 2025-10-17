/**
 * MCP Server
 * Main Model Context Protocol server initialization and startup logic
 *
 * This module handles:
 * - SQLite database initialization
 * - Embedding service setup (OpenAI)
 * - Knowledge graph manager creation
 * - MCP server configuration and startup
 *
 * Architecture:
 * The server uses a layered architecture:
 * 1. Storage Layer (SQLite) - Persists entities, relations, and embeddings
 * 2. Embedding Layer (OpenAI) - Generates vector embeddings for semantic search
 * 3. Knowledge Graph Layer - Manages entities and relations
 * 4. MCP Protocol Layer - Exposes tools via Model Context Protocol
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { DB } from "@takinprofit/sqlite-x"
import { load as loadSqliteVec } from "sqlite-vec"
import { env } from "#config"
import { SqliteDb } from "#db/sqlite-db"
import { SqliteSchemaManager } from "#db/sqlite-schema-manager"
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
 * - SQLite storage backend
 * - OpenAI embedding service
 * - Knowledge graph management
 * - stdio transport for communication
 *
 * Environment Variables:
 * - DFM_SQLITE_LOCATION: SQLite database location (default: ./devflow.db)
 * - DFM_OPENAI_API_KEY: OpenAI API key for embeddings (optional, uses random if missing)
 * - DFM_EMBEDDING_RATE_LIMIT_TOKENS: Rate limit for embedding requests (default: from env config)
 * - DFM_EMBEDDING_RATE_LIMIT_INTERVAL: Rate limit interval in ms (default: from env config)
 *
 * @throws {Error} If server initialization fails
 */
export default async function startMcpServer(): Promise<void> {
  try {
    logger.info("Starting DevFlow MCP server...")

    // ========================================================================
    // Step 1: Initialize SQLite Database
    // ========================================================================
    logger.debug("Initializing SQLite database...")
    const db = new DB({
      location: env.DFM_SQLITE_LOCATION,
      logger,
      allowExtension: true,
    })

    // Load sqlite-vec extension
    logger.debug("Loading sqlite-vec extension...")
    loadSqliteVec(db.nativeDb)

    // Apply internal optimizations (not user-configurable)
    logger.debug("Applying SQLite optimizations...")
    db.exec("PRAGMA journal_mode = WAL")
    db.exec("PRAGMA cache_size = -64000") // 64MB
    db.exec("PRAGMA busy_timeout = 5000")
    db.exec("PRAGMA synchronous = NORMAL")
    db.exec("PRAGMA temp_store = MEMORY")

    // Initialize schema
    logger.debug("Initializing database schema...")
    const schemaManager = new SqliteSchemaManager(db, logger)
    await schemaManager.initializeSchema()

    // Create database instances (explicit SQLite classes)
    logger.debug("Creating database...")
    const sqliteDb = new SqliteDb(db, logger)

    // ========================================================================
    // Step 2: Create Knowledge Graph Manager
    // ========================================================================
    logger.debug("Creating knowledge graph manager...")
    const knowledgeGraphManager = new KnowledgeGraphManager({
      database: sqliteDb,
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
