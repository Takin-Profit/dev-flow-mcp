/**
 * E2E Test Suite Runner
 * Single entry point that spawns ONE MCP server for ALL E2E tests
 * This ensures efficient testing and easier debugging
 */

import { after, before, describe } from "node:test"
import {
  cleanupAllTestData,
  closeSharedClient,
  getSharedClient,
} from "./fixtures/shared-client.js"

// Import all test suites
import "./00-mcp-client.test.js"
import "./01-crud.test.js"
import "./02-relations.test.js"
import "./03-search.test.js"
import "./04-validation.test.js"
import "./05-temporal.test.js"

describe("E2E Test Suite", () => {
  let sharedClient

  before(async () => {
    console.log("Setting up single MCP server for all E2E tests...")
    // Initialize the shared client ONCE for all tests
    sharedClient = await getSharedClient()
    console.log("MCP server ready")

    // Clean up any existing test data
    await cleanupAllTestData()
  })

  after(async () => {
    console.log("Cleaning up and shutting down MCP server...")
    // Clean up test data
    await cleanupAllTestData()

    // Close the shared client connection
    await closeSharedClient()
    console.log("MCP server shut down")
  })

  // All tests from imported files will run here with the shared client
})
