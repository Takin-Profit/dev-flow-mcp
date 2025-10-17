/**
 * E2E Tests: MCP Client Integration
 * Basic smoke tests for MCP server communication
 */

import { deepStrictEqual, ok } from "node:assert/strict"
import { after, before, describe, test } from "node:test"
import { getSharedClient } from "./fixtures/shared-client.js"

describe("E2E: MCP Client Integration", () => {
  let client
  let helper
  const entityName1 = `test_entity_1_${Date.now()}`
  const entityName2 = `test_entity_2_${Date.now()}`

  before(async () => {
    // Get shared client
    const shared = await getSharedClient()
    client = shared.client
    helper = shared.helper

    // Create entities for relation tests
    await helper.createEntities([
      {
        name: entityName1,
        entityType: "feature",
        observations: ["Test entity 1"],
      },
      {
        name: entityName2,
        entityType: "feature",
        observations: ["Test entity 2"],
      },
    ])
  })

  after(async () => {
    // Clean up created entities
    try {
      await helper.deleteEntities([entityName1, entityName2])
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  test("should list available tools", async () => {
    const response = await client.listTools()
    const tools = response.tools

    const createEntitiesTool = tools.find(
      (tool) => tool.name === "create_entities"
    )
    ok(createEntitiesTool, "create_entities tool should exist")

    const readGraphTool = tools.find((tool) => tool.name === "read_graph")
    ok(readGraphTool, "read_graph tool should exist")
  })

  test("should create and read an entity", async () => {
    const result = await client.callTool({
      name: "read_graph",
      arguments: {},
    })

    ok(result.content, "should have content")
    ok(
      Array.isArray(result.content) && result.content.length > 0,
      "should have content array"
    )
    const content = result.content[0]
    ok(content.type === "text", "content should be text")

    if (content.type === "text") {
      const graph = JSON.parse(content.text)
      const foundEntity = graph.entities.find((e) => e.name === entityName1)
      ok(foundEntity, "created entity should be found in the graph")
    }
  })

  test("should create and read a relation", async () => {
    const createResult = await client.callTool({
      name: "create_relations",
      arguments: {
        relations: [
          { from: entityName1, to: entityName2, relationType: "relates_to" },
        ],
      },
    })

    ok(createResult.content, "should have content")
    ok(
      Array.isArray(createResult.content) && createResult.content.length > 0,
      "should have content array"
    )
    const createContent = createResult.content[0]
    ok(createContent.type === "text", "content should be text")

    if (createContent.type === "text") {
      const createdRelation = JSON.parse(createContent.text)[0]
      deepStrictEqual(createdRelation.from, entityName1)
      deepStrictEqual(createdRelation.to, entityName2)
      deepStrictEqual(createdRelation.relationType, "relates_to")
    }

    const getResult = await client.callTool({
      name: "get_relation",
      arguments: {
        from: entityName1,
        to: entityName2,
        relationType: "relates_to",
      },
    })

    ok(getResult.content, "should have content")
    ok(
      Array.isArray(getResult.content) && getResult.content.length > 0,
      "should have content array"
    )
    const getContent = getResult.content[0]
    ok(getContent.type === "text", "content should be text")

    if (getContent.type === "text") {
      const relation = JSON.parse(getContent.text)
      deepStrictEqual(relation.from, entityName1)
      deepStrictEqual(relation.to, entityName2)
      deepStrictEqual(relation.relationType, "relates_to")
    }
  })

  test("should perform semantic search", async () => {
    const result = await client.callTool({
      name: "semantic_search",
      arguments: { query: "test entity" },
    })

    ok(result.content, "should have content")
    ok(
      Array.isArray(result.content) && result.content.length > 0,
      "should have content array"
    )
    const content = result.content[0]
    ok(content.type === "text", "content should be text")

    if (content.type === "text") {
      const searchResults = JSON.parse(content.text)
      // Just verify we got a response - semantic search might return empty results
      ok(
        searchResults !== null && searchResults !== undefined,
        "should have search results"
      )
    }
  })
})
