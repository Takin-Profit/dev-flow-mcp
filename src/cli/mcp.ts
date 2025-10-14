/**
 * MCP CLI Command
 * Starts the Model Context Protocol server
 *
 * Usage:
 *   dfm mcp              # Start MCP server
 *   dfm mcp --help       # Show help
 *
 * The MCP server communicates via stdio and is typically invoked by
 * MCP clients (like Claude Desktop) rather than manually.
 */

import { buildCommand } from "@stricli/core"
import type { CliContext } from "#cli/app"
import startMcpServer from "#server"

/**
 * MCP command implementation
 * Starts the MCP server on stdio transport
 */
async function mcpCommandImpl(this: CliContext): Promise<void> {
  try {
    // Start the MCP server
    // Note: This will block and run until the server is terminated
    await startMcpServer()
  } catch (error) {
    // Error logging is handled in startMcpServer
    // Exit with error code
    this.process.exit(1)
  }
}

/**
 * MCP command definition
 * No flags or arguments - just starts the server
 */
export const mcpCommand = buildCommand({
  loader: async () => mcpCommandImpl,
  parameters: {
    flags: {},
    positional: {
      kind: "tuple",
      parameters: [],
    },
  },
  docs: {
    brief: "Start the MCP (Model Context Protocol) server",
    fullDescription:
      "Starts the DevFlow MCP server which provides knowledge graph management\n" +
      "and semantic search capabilities via the Model Context Protocol.\n\n" +
      "The server communicates via stdio and is typically invoked by MCP clients\n" +
      "(such as Claude Desktop) rather than run manually.\n\n" +
      "Environment Variables:\n" +
      "  DFM_OPENAI_API_KEY             OpenAI API key for embeddings\n" +
      "  DFM_OPENAI_EMBEDDING_MODEL     Embedding model (default: text-embedding-3-small)\n" +
      "  DFM_EMBEDDING_RATE_LIMIT_TOKENS  Rate limit (default: 150000)\n" +
      "  DFM_EMBEDDING_RATE_LIMIT_INTERVAL Rate limit interval ms (default: 60000)\n" +
      "  NEO4J_URI                      Neo4j connection URI\n" +
      "  NEO4J_USERNAME                 Neo4j username\n" +
      "  NEO4J_PASSWORD                 Neo4j password\n" +
      "  NEO4J_DATABASE                 Neo4j database name\n" +
      "  DFM_LOG_LEVEL                  Log level (error|warn|info|debug)",
  },
})
