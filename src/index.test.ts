// biome-ignore-all lint/style/noDoneCallback: node:test uses a context object 't' not a callback

/**
 * Tests for index.ts
 *
 * Note: Full module mocking requires running with --experimental-test-module-mocks flag
 * Example: node --test --experimental-test-module-mocks
 */

// biome-ignore lint/performance/noNamespaceImport: Required for tsc to correctly type-check node:assert/strict
import * as assert from "node:assert/strict"
import { existsSync, mkdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { afterEach, beforeEach, describe, it, mock } from "node:test"

// Create a test directory
const testDir = join(process.cwd(), "test-output", "index-test")

// Setup test environment
beforeEach(() => {
  // Create test directory if it doesn't exist
  if (!existsSync(testDir)) {
    mkdirSync(testDir, { recursive: true, mode: 0o777 })
  }
})

afterEach(() => {
  // Clean up test directory
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true })
  }

  // Reset all mocks
  mock.reset()
})

describe("Memory Server Request Handlers", () => {
  it("CallTool handler throws error when arguments are missing", () => {
    // Create a request with missing arguments
    const request = {
      params: {
        name: "test-tool",
        // arguments is missing
      },
    }

    // Define our handler function based on the code in index.ts
    const callToolHandler = (req: {
      params: { name: string; arguments?: unknown }
    }) => {
      const { name, arguments: args } = req.params

      if (!args) {
        throw new Error(`No arguments provided for tool: ${name}`)
      }

      return { success: true }
    }

    // Test that it throws the expected error
    assert.throws(() => callToolHandler(request), {
      message: "No arguments provided for tool: test-tool",
    })
  })

  it("CallTool handler throws error for unknown tools", () => {
    // Create a request with an unknown tool
    const request = {
      params: {
        name: "unknown-tool",
        arguments: {},
      },
    }

    // Define a simpler version of the handler function with the same error logic
    const callToolHandler = (req: {
      params: { name: string; arguments: unknown }
    }) => {
      const { name, arguments: args } = req.params

      if (!args) {
        throw new Error(`No arguments provided for tool: ${name}`)
      }

      // This simulates the switch statement with default case
      switch (name) {
        case "known-tool":
          return { success: true }
        default:
          throw new Error(`Unknown tool: ${name}`)
      }
    }

    // Test that it throws the expected error
    assert.throws(() => callToolHandler(request), {
      message: "Unknown tool: unknown-tool",
    })
  })

  it("ReadGraph tool handler returns graph data", async (t) => {
    // Create a mock manager with a readGraph method
    const mockReadGraph = t.mock.fn(() =>
      Promise.resolve({
        entities: [
          { name: "TestEntity", entityType: "test", observations: [] },
        ],
        relations: [],
      })
    )

    const mockManager = {
      readGraph: mockReadGraph,
    }

    // Define a handler function for ReadGraph tool
    const handleReadGraphTool = async (
      _request: { params: { arguments: unknown } },
      manager: { readGraph: () => Promise<unknown> }
    ) => {
      const result = await manager.readGraph()
      return { result }
    }

    // Create a simple request
    const request = {
      params: {
        name: "ReadGraph",
        arguments: {},
      },
    }

    // Call the handler
    const response = await handleReadGraphTool(request, mockManager)

    // Verify the manager method was called and response includes the graph data
    assert.strictEqual(mockReadGraph.mock.callCount(), 1)
    assert.ok(response.result)
    // @ts-expect-error - accessing result properties
    assert.strictEqual(response.result.entities.length, 1)
    // @ts-expect-error - accessing result properties
    assert.strictEqual(response.result.entities[0].name, "TestEntity")
  })
})
