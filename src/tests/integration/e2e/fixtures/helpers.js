/**
 * Test Helper Functions
 * Utilities for e2e testing
 */

import { ok } from "node:assert/strict"

/**
 * MCP Test Client wrapper with helper methods
 */
export class MCPTestHelper {
  client

  constructor(client, _transport) {
    this.client = client
  }

  /**
   * Call a tool and parse JSON response
   */
  async callToolJSON(name, args) {
    const result = await this.client.callTool({
      name,
      arguments: args,
    })

    ok(result.content, "should have content")
    ok(
      Array.isArray(result.content) && result.content.length > 0,
      "should have content array"
    )

    const content = result.content[0]
    ok(content.type === "text", "content should be text")

    if (content.type === "text") {
      return JSON.parse(content.text)
    }

    throw new Error("Invalid content type")
  }

  /**
   * Call a tool and expect it to fail with specific error
   */
  async expectToolError(name, args, expectedMessage) {
    try {
      await this.client.callTool({
        name,
        arguments: args,
      })
      throw new Error(`Expected tool ${name} to fail but it succeeded`)
    } catch (error) {
      if (expectedMessage && error instanceof Error) {
        ok(
          error.message.includes(expectedMessage),
          `Expected error message to include "${expectedMessage}", got "${error.message}"`
        )
      }
      return error
    }
  }

  /**
   * Create entities and return created data
   */
  async createEntities(entities) {
    return await this.callToolJSON("create_entities", { entities })
  }

  /**
   * Delete entities by names
   */
  async deleteEntities(entityNames) {
    return await this.callToolJSON("delete_entities", { entityNames })
  }

  /**
   * Create relations and return created data
   */
  async createRelations(relations) {
    return await this.callToolJSON("create_relations", { relations })
  }

  /**
   * Read entire graph
   */
  async readGraph() {
    return await this.callToolJSON("read_graph", {})
  }

  /**
   * Search for nodes
   */
  async searchNodes(query) {
    return await this.callToolJSON("search_nodes", { query })
  }

  /**
   * Semantic search
   */
  async semanticSearch(query, options) {
    return await this.callToolJSON("semantic_search", {
      query,
      ...options,
    })
  }

  /**
   * Get specific relation
   */
  async getRelation(from, to, relationType) {
    return await this.callToolJSON("get_relation", {
      from,
      to,
      relationType,
    })
  }

  /**
   * List all available tools
   */
  async listTools() {
    const response = await this.client.listTools()
    return response.tools
  }

  /**
   * Close the client connection
   */
  async close() {
    await this.client.close()
  }
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(condition, timeout = 5000, interval = 100) {
  const start = Date.now()

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`)
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Generate random string
 */
export function randomString(length = 10) {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length)
}

/**
 * Assert array contains item matching predicate
 */
export function assertArrayContains(array, predicate, message) {
  const found = array.some(predicate)
  ok(found, message || "Array should contain matching item")
}

/**
 * Assert array does not contain item matching predicate
 */
export function assertArrayNotContains(array, predicate, message) {
  const found = array.some(predicate)
  ok(!found, message || "Array should not contain matching item")
}
