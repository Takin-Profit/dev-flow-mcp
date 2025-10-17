/**
 * Shared MCP Client for E2E Tests
 * Single client instance used across all test files to avoid spawning multiple servers
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { MCPTestHelper } from "./helpers.js"

let client = null
let transport = null
let helper = null
let isConnected = false

/**
 * Get or create the shared MCP client
 */
export async function getSharedClient() {
  if (!isConnected) {
    // Create transport with command and environment variables
    transport = new StdioClientTransport({
      command: "./dist/cli/index.js",
      args: ["mcp"],
      env: {
        ...process.env,
        DFM_ENV: "testing",
        NEO4J_URI: process.env.NEO4J_URI || "bolt://localhost:7687",
        NEO4J_USERNAME: process.env.NEO4J_USERNAME || "neo4j",
        NEO4J_PASSWORD: process.env.NEO4J_PASSWORD || "dfm_password",
      },
    })

    client = new Client(
      {
        name: "e2e-shared-test-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    )

    // Connect to server
    await client.connect(transport)
    helper = new MCPTestHelper(client, transport)
    isConnected = true
  }

  return { client, transport, helper }
}

/**
 * Close the shared client connection
 */
export async function closeSharedClient() {
  if (isConnected && client) {
    await client.close()
    client = null
    transport = null
    helper = null
    isConnected = false
  }
}

/**
 * Clean up all test data in the graph
 */
export async function cleanupAllTestData() {
  if (!helper) {
    return
  }

  try {
    const graph = await helper.readGraph()
    if (graph.entities && graph.entities.length > 0) {
      const entityNames = graph.entities.map((e) => e.name)
      await helper.deleteEntities(entityNames)
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}
