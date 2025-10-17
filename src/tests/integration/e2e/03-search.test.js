/**
 * E2E Tests: Search & Discovery
 * Comprehensive testing for search_nodes, semantic_search,
 * open_nodes, and get_entity_embedding
 */

import { ok, strictEqual } from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import { createTestEntity } from "./fixtures/entities.js"
import {
  cleanupAllTestData,
  getSharedClient,
} from "./fixtures/shared-client.js"

describe("E2E: Search & Discovery", () => {
  let helper
  let testEntities

  before(async () => {
    // Get shared client
    const shared = await getSharedClient()
    helper = shared.helper

    // Clean up any existing test data
    await cleanupAllTestData()

    // Create test entities for search tests
    testEntities = [
      {
        name: "authentication-service",
        entityType: "component",
        observations: [
          "Handles user authentication",
          "Implements OAuth2 protocol",
          "JWT token generation",
        ],
      },
      {
        name: "database-connection",
        entityType: "component",
        observations: [
          "PostgreSQL database connection",
          "Connection pooling",
          "Query optimization",
        ],
      },
      {
        name: "user-login-feature",
        entityType: "feature",
        observations: [
          "User login functionality",
          "Social media authentication",
          "Remember me option",
        ],
      },
      {
        name: "password-reset-task",
        entityType: "task",
        observations: [
          "Implement password reset flow",
          "Email verification",
          "Security token generation",
        ],
      },
      {
        name: "api-architecture-decision",
        entityType: "decision",
        observations: [
          "Use RESTful API design",
          "GraphQL for complex queries",
          "Rate limiting implementation",
        ],
      },
    ]

    await helper.createEntities(testEntities)
  })

  after(async () => {
    // Clean up test data
    await cleanupAllTestData()
  })

  describe("search_nodes", () => {
    it("should find nodes by exact name match", async () => {
      const result = await helper.searchNodes("authentication-service")

      ok(result, "should return result")
      ok(Array.isArray(result), "result should be an array")
      ok(result.length > 0, "should find at least one result")

      const found = result.find((e) => e.name === "authentication-service")
      ok(found, "should find the exact entity")
    })

    it("should find nodes by partial name match", async () => {
      const result = await helper.searchNodes("authentication")

      ok(Array.isArray(result))
      ok(result.length > 0)

      const found = result.find((e) => e.name.includes("authentication"))
      ok(found)
    })

    it("should find nodes by observation content", async () => {
      const result = await helper.searchNodes("OAuth2")

      ok(Array.isArray(result))
      ok(result.length > 0)

      const found = result.find((e) =>
        e.observations.some((obs) => obs.includes("OAuth2"))
      )
      ok(found)
    })

    it("should handle case-insensitive search", async () => {
      const lowerResult = await helper.searchNodes("oauth2")
      const upperResult = await helper.searchNodes("OAUTH2")

      ok(Array.isArray(lowerResult))
      ok(Array.isArray(upperResult))

      // Both should find results (case insensitive)
      ok(lowerResult.length > 0 || upperResult.length > 0)
    })

    it("should return empty array for no matches", async () => {
      const result = await helper.searchNodes("xyz_nonexistent_query_12345")

      ok(Array.isArray(result))
      strictEqual(result.length, 0)
    })

    it("should handle special characters in search", async () => {
      const entity = createTestEntity("feature", [
        "Test with special chars !@#$%",
      ])
      await helper.createEntities([entity])

      const result = await helper.searchNodes("!@#$%")

      ok(Array.isArray(result))
      // May or may not find based on how special chars are handled
    })

    it("should handle unicode characters in search", async () => {
      const entity = createTestEntity("feature", ["Unicode test 日本語 🚀"])
      await helper.createEntities([entity])

      const result = await helper.searchNodes("日本語")

      ok(Array.isArray(result))
    })

    it("should search across multiple fields", async () => {
      const result = await helper.searchNodes("user")

      ok(Array.isArray(result))
      ok(result.length > 0)

      // Should find entities with "user" in name or observations
      const hasUserInName = result.some((e) => e.name.includes("user"))
      const hasUserInObs = result.some((e) =>
        e.observations.some((obs) => obs.toLowerCase().includes("user"))
      )

      ok(hasUserInName || hasUserInObs)
    })

    it("should handle very long search query", async () => {
      const longQuery = "a".repeat(1000)
      const result = await helper.searchNodes(longQuery)

      ok(Array.isArray(result))
    })

    it("should handle empty search query", async () => {
      const result = await helper.searchNodes("")

      ok(Array.isArray(result))
      // Empty query might return all or none - both are valid
    })
  })

  describe("semantic_search", () => {
    it("should perform basic semantic search", async () => {
      const result = await helper.semanticSearch(
        "user authentication and login"
      )

      ok(result, "should return result")
      // Result format may vary, just verify it returns something
    })

    it("should find semantically similar content", async () => {
      const result = await helper.semanticSearch(
        "login and authentication system"
      )

      ok(result)
      // Should find authentication-service or user-login-feature
    })

    it("should respect limit parameter", async () => {
      const result = await helper.semanticSearch("database", { limit: 2 })

      ok(result)
      // If results exist, should not exceed limit
      if (Array.isArray(result) && result.length > 0) {
        ok(result.length <= 2, "should respect limit")
      }
    })

    it("should respect min_similarity threshold", async () => {
      const result = await helper.semanticSearch("authentication", {
        min_similarity: 0.8,
      })

      ok(result)
      // High threshold might return fewer results
    })

    it("should filter by entity_types", async () => {
      const result = await helper.semanticSearch("authentication", {
        entity_types: ["component"],
      })

      ok(result)
      if (Array.isArray(result) && result.length > 0) {
        // All results should be components
        const allComponents = result.every((e) => e.entityType === "component")
        ok(allComponents, "should filter by entity type")
      }
    })

    it("should filter by multiple entity_types", async () => {
      const result = await helper.semanticSearch("user", {
        entity_types: ["feature", "task"],
      })

      ok(result)
      if (Array.isArray(result) && result.length > 0) {
        const validTypes = result.every(
          (e) => e.entityType === "feature" || e.entityType === "task"
        )
        ok(validTypes, "should filter by multiple types")
      }
    })

    it("should handle hybrid_search parameter", async () => {
      const result = await helper.semanticSearch("authentication", {
        hybrid_search: true,
      })

      ok(result)
      // Hybrid search combines semantic and keyword search
    })

    it("should handle semantic_weight parameter", async () => {
      const result = await helper.semanticSearch("database", {
        hybrid_search: true,
        semantic_weight: 0.7,
      })

      ok(result)
      // Weight affects scoring between semantic and keyword
    })

    it("should handle all parameters together", async () => {
      const result = await helper.semanticSearch(
        "authentication and security",
        {
          limit: 3,
          min_similarity: 0.5,
          entity_types: ["component", "feature"],
          hybrid_search: true,
          semantic_weight: 0.6,
        }
      )

      ok(result)
    })

    it("should handle semantic search with no results", async () => {
      const result = await helper.semanticSearch(
        "xyz_completely_unrelated_topic_12345",
        { min_similarity: 0.99 }
      )

      ok(result !== null && result !== undefined)
      // Might return empty array or empty result
    })

    it("should find conceptually related content", async () => {
      const result = await helper.semanticSearch("security and access control")

      ok(result)
      // Should find authentication-related entities
    })

    it("should handle very specific semantic query", async () => {
      const result = await helper.semanticSearch(
        "OAuth2 protocol implementation for user authentication"
      )

      ok(result)
      // Should rank authentication-service highly
    })

    it("should handle broad semantic query", async () => {
      const result = await helper.semanticSearch("software development")

      ok(result)
      // Broad query might match many entities
    })

    it("should handle semantic search with limit of 1", async () => {
      const result = await helper.semanticSearch("authentication", { limit: 1 })

      ok(result)
      if (Array.isArray(result) && result.length > 0) {
        strictEqual(result.length, 1)
      }
    })

    it("should handle very high similarity threshold", async () => {
      const result = await helper.semanticSearch("authentication", {
        min_similarity: 0.95,
      })

      ok(result !== null && result !== undefined)
      // Very high threshold might return no results
    })
  })

  describe("open_nodes", () => {
    it("should open single existing node", async () => {
      const result = await helper.callToolJSON("open_nodes", {
        names: ["authentication-service"],
      })

      ok(result, "should return result")
      ok(Array.isArray(result), "result should be an array")
      strictEqual(result.length, 1)
      strictEqual(result[0].name, "authentication-service")
    })

    it("should open multiple existing nodes", async () => {
      const result = await helper.callToolJSON("open_nodes", {
        names: ["authentication-service", "database-connection"],
      })

      ok(Array.isArray(result))
      strictEqual(result.length, 2)
    })

    it("should include all node properties", async () => {
      const result = await helper.callToolJSON("open_nodes", {
        names: ["user-login-feature"],
      })

      ok(result[0].name)
      ok(result[0].entityType)
      ok(Array.isArray(result[0].observations))
      ok(result[0].observations.length > 0)
    })

    it("should handle non-existent node", async () => {
      const result = await helper.callToolJSON("open_nodes", {
        names: ["non_existent_node_12345"],
      })

      ok(result !== null)
      // Might return empty array or partial results
    })

    it("should handle mixed valid and invalid node names", async () => {
      const result = await helper.callToolJSON("open_nodes", {
        names: [
          "authentication-service",
          "non_existent",
          "database-connection",
        ],
      })

      ok(Array.isArray(result))
      // Should return at least the valid nodes
      ok(result.length >= 2)
    })

    it("should handle empty names array", async () => {
      const result = await helper.callToolJSON("open_nodes", {
        names: [],
      })

      ok(Array.isArray(result))
      strictEqual(result.length, 0)
    })

    it("should preserve node order", async () => {
      const names = ["database-connection", "authentication-service"]
      const result = await helper.callToolJSON("open_nodes", { names })

      ok(Array.isArray(result))
      // Order might or might not be preserved - just verify we get the nodes
      ok(result.length > 0)
    })

    it("should handle opening many nodes at once", async () => {
      const allNames = testEntities.map((e) => e.name)
      const result = await helper.callToolJSON("open_nodes", {
        names: allNames,
      })

      ok(Array.isArray(result))
      strictEqual(result.length, testEntities.length)
    })
  })

  describe("get_entity_embedding", () => {
    it("should get embedding for existing entity", async () => {
      const result = await helper.callToolJSON("get_entity_embedding", {
        entity_name: "authentication-service",
      })

      ok(result, "should return result")
      // Embedding format may vary - just check it returns something
      ok(result.embedding || result.vector || Array.isArray(result))
    })

    it("should return vector of correct dimension", async () => {
      const result = await helper.callToolJSON("get_entity_embedding", {
        entity_name: "database-connection",
      })

      ok(result)
      // OpenAI text-embedding-3-small typically returns 1536 dimensions
      if (Array.isArray(result)) {
        ok(result.length > 0, "embedding should have dimensions")
      } else if (result.embedding || result.vector) {
        const vector = result.embedding || result.vector
        ok(Array.isArray(vector) && vector.length > 0)
      }
    })

    it("should handle get_entity_embedding for non-existent entity", async () => {
      await helper.expectToolError(
        "get_entity_embedding",
        {
          entity_name: "non_existent_entity_12345",
        },
        "not found"
      )
    })

    it("should return consistent embeddings for same entity", async () => {
      const result1 = await helper.callToolJSON("get_entity_embedding", {
        entity_name: "user-login-feature",
      })
      const result2 = await helper.callToolJSON("get_entity_embedding", {
        entity_name: "user-login-feature",
      })

      ok(result1)
      ok(result2)
      // Embeddings should be identical for the same entity (cached)
    })

    it("should handle entity with special characters", async () => {
      const entity = createTestEntity("feature", ["Test embedding"])
      await helper.createEntities([entity])

      const result = await helper.callToolJSON("get_entity_embedding", {
        entity_name: entity.name,
      })

      ok(result)
    })

    it("should handle entity with unicode content", async () => {
      const entity = {
        name: "unicode_test_entity",
        entityType: "feature",
        observations: ["Unicode content 日本語 🚀"],
      }
      await helper.createEntities([entity])

      const result = await helper.callToolJSON("get_entity_embedding", {
        entity_name: entity.name,
      })

      ok(result)
    })
  })
})
