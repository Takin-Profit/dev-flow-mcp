import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import {
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  ListToolsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import type { KnowledgeGraphManager } from "#knowledge-graph-manager"
import { handleCallToolRequest } from "#server/handlers/call-tool-handler"
import { handleListToolsRequest } from "#server/handlers/list-tools-handler"
import {
  GetContextArgsSchema,
  InitProjectArgsSchema,
  RememberWorkArgsSchema,
  ReviewContextArgsSchema,
} from "#prompts/schemas"
import {
  handleGetContext,
  handleInitProject,
  handleRememberWork,
  handleReviewContext,
} from "#prompts/handlers"
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
      name: "devflow-mcp",
      version: "1.0.0",
      description: "DevFlow MCP: Your persistent knowledge graph memory system",
      publisher: "Takin-Profit",
    },
    {
      capabilities: {
        tools: {},
        prompts: {}, // Enable prompts capability
        serverInfo: {},
        notifications: {},
        logging: {},
      },
    }
  )

  // ============================================================================
  // Tool Handlers
  // ============================================================================

  // Register request handlers
  server.setRequestHandler(ListToolsRequestSchema, (_request) => {
    const result = handleListToolsRequest()
    return result
  })

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const result = await handleCallToolRequest(
      request,
      knowledgeGraphManager,
      logger
    )
    return result
  })

  // ============================================================================
  // Prompt Handlers
  // ============================================================================

  // List available prompts
  server.setRequestHandler(ListPromptsRequestSchema, () => {
    return {
      prompts: [
        {
          name: "init-project",
          description:
            "Start a new project or feature. Guides planners on creating feature entities and structuring planning information.",
          arguments: [
            {
              name: "projectName",
              description: "The name of the project or feature",
              required: true,
            },
            {
              name: "description",
              description: "High-level description of what this project will do",
              required: true,
            },
            {
              name: "goals",
              description: "Specific goals or requirements for this project",
              required: false,
            },
          ],
        },
        {
          name: "get-context",
          description:
            "Retrieve relevant information before working. Helps any agent search the knowledge graph for history, dependencies, and context.",
          arguments: [
            {
              name: "query",
              description: "What are you working on? (used for semantic search)",
              required: true,
            },
            {
              name: "entityTypes",
              description:
                "Filter by specific entity types (feature, task, decision, component, test)",
              required: false,
            },
            {
              name: "includeHistory",
              description: "Include version history of entities",
              required: false,
            },
          ],
        },
        {
          name: "remember-work",
          description:
            "Store completed work in the knowledge graph. Guides agents on creating entities with appropriate types and relations.",
          arguments: [
            {
              name: "workType",
              description: "What type of work did you complete?",
              required: true,
            },
            {
              name: "name",
              description:
                "Name/title of the work (e.g., 'UserAuth', 'LoginEndpoint')",
              required: true,
            },
            {
              name: "description",
              description: "What did you do? (stored as observations)",
              required: true,
            },
            {
              name: "implementsTask",
              description:
                "Name of the task this work implements (creates 'implements' relation)",
              required: false,
            },
            {
              name: "partOfFeature",
              description:
                "Name of the feature this is part of (creates 'part_of' relation)",
              required: false,
            },
            {
              name: "dependsOn",
              description:
                "Names of other components this depends on (creates 'depends_on' relations)",
              required: false,
            },
            {
              name: "keyDecisions",
              description: "Any important decisions made during this work",
              required: false,
            },
          ],
        },
        {
          name: "review-context",
          description:
            "Get full context before reviewing. Helps reviewers gather all relevant information about a piece of work.",
          arguments: [
            {
              name: "entityName",
              description: "Name of the entity to review (component, task, etc.)",
              required: true,
            },
            {
              name: "includeRelated",
              description:
                "Include related entities (dependencies, implementations, etc.)",
              required: false,
            },
            {
              name: "includeDecisions",
              description: "Include decision history related to this entity",
              required: false,
            },
          ],
        },
      ],
    }
  })

  // Get specific prompt
  server.setRequestHandler(GetPromptRequestSchema, (request) => {
    const { name, arguments: args } = request.params

    switch (name) {
      case "init-project": {
        const parsedArgs = InitProjectArgsSchema.parse(args)
        return handleInitProject(parsedArgs)
      }
      case "get-context": {
        const parsedArgs = GetContextArgsSchema.parse(args)
        return handleGetContext(parsedArgs)
      }
      case "remember-work": {
        const parsedArgs = RememberWorkArgsSchema.parse(args)
        return handleRememberWork(parsedArgs)
      }
      case "review-context": {
        const parsedArgs = ReviewContextArgsSchema.parse(args)
        return handleReviewContext(parsedArgs)
      }
      default:
        throw new Error(`Unknown prompt: ${name}`)
    }
  })

  return server
}

