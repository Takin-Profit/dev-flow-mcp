import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import type { KnowledgeGraphManager } from "#knowledge-graph-manager"
import { handleCallToolRequest } from "#server/handlers/call-tool-handler"
import { handleListToolsRequest } from "#server/handlers/list-tools-handler"
import type { Logger } from "#types"

/**
 * Sets up and configures the MCP server with the appropriate request handlers.
 *
 * @param knowledgeGraphManager The KnowledgeGraphManager instance to use for request handling
 * @param logger Logger instance for structured logging
 * @returns The configured server instance
 */
export function setupServer(
  knowledgeGraphManager: KnowledgeGraphManager,
  logger: Logger
): Server {
  // Create server instance
  const server = new Server(
    {
      name: "memento-mcp",
      version: "1.0.0",
      description: "Memento MCP: Your persistent knowledge graph memory system",
      publisher: "gannonh",
    },
    {
      capabilities: {
        tools: {},
        serverInfo: {}, // Add this capability to fix the error
        notifications: {}, // Add this capability for complete support
        logging: {}, // Add this capability for complete support
      },
    }
  )

  // Register request handlers
  server.setRequestHandler(ListToolsRequestSchema, async (_request) => {
    try {
      const result = await handleListToolsRequest()
      return result
    } catch (error: unknown) {
      throw error
    }
  })

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const result = await handleCallToolRequest(
        request,
        knowledgeGraphManager,
        logger
      )
      return result
    } catch (error: unknown) {
      throw error
    }
  })

  return server
}
