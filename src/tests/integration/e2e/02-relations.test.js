/**
 * E2E Tests: Relations
 * Comprehensive testing for create_relations, get_relation,
 * update_relation, and delete_relations
 */

import { ok, strictEqual } from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import { createTestEntity } from "./fixtures/entities.js"
import { createCircularRelations } from "./fixtures/relations.js"
import {
  cleanupAllTestData,
  getSharedClient,
} from "./fixtures/shared-client.js"

describe("E2E: Relations", () => {
  let helper

  before(async () => {
    // Get shared client
    const shared = await getSharedClient()
    helper = shared.helper

    // Clean up any existing test data
    await cleanupAllTestData()
  })

  after(async () => {
    // Clean up test data
    await cleanupAllTestData()
  })

  describe("create_relations", () => {
    it("should create a basic relation between two entities", async () => {
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      const result = await helper.createRelations([
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "relates_to",
        },
      ])

      ok(result, "should return result")
      ok(Array.isArray(result), "result should be an array")
      strictEqual(result.length, 1)
    })

    it("should create relation with depends_on type", async () => {
      const entities = [
        createTestEntity("component"),
        createTestEntity("component"),
      ]
      await helper.createEntities(entities)

      const result = await helper.createRelations([
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "depends_on",
        },
      ])

      strictEqual(result[0].relationType, "depends_on")
    })

    it("should create relation with implements type", async () => {
      const entities = [
        createTestEntity("feature"),
        createTestEntity("decision"),
      ]
      await helper.createEntities(entities)

      const result = await helper.createRelations([
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "implements",
        },
      ])

      strictEqual(result[0].relationType, "implements")
    })

    it("should create relation with part_of type", async () => {
      const entities = [createTestEntity("task"), createTestEntity("feature")]
      await helper.createEntities(entities)

      const result = await helper.createRelations([
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "part_of",
        },
      ])

      strictEqual(result[0].relationType, "part_of")
    })

    it("should create relation with relates_to type", async () => {
      const entities = [
        createTestEntity("decision"),
        createTestEntity("feature"),
      ]
      await helper.createEntities(entities)

      const result = await helper.createRelations([
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "relates_to",
        },
      ])

      strictEqual(result[0].relationType, "relates_to")
    })

    it("should create multiple relations in batch", async () => {
      const entities = [
        createTestEntity("feature"),
        createTestEntity("task"),
        createTestEntity("component"),
      ]
      await helper.createEntities(entities)

      const relations = [
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "relates_to",
        },
        {
          from: entities[1].name,
          to: entities[2].name,
          relationType: "depends_on",
        },
      ]

      const result = await helper.createRelations(relations)
      strictEqual(result.length, 2)
    })

    it("should create relation with strength parameter", async () => {
      const entities = [
        createTestEntity("component"),
        createTestEntity("component"),
      ]
      await helper.createEntities(entities)

      const result = await helper.createRelations([
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "depends_on",
          strength: 0.8,
        },
      ])

      ok(result[0].strength !== undefined)
    })

    it("should create relation with confidence parameter", async () => {
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      const result = await helper.createRelations([
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "relates_to",
          confidence: 0.9,
        },
      ])

      ok(result[0].confidence !== undefined)
    })

    it("should create relation with both strength and confidence", async () => {
      const entities = [
        createTestEntity("component"),
        createTestEntity("component"),
      ]
      await helper.createEntities(entities)

      const result = await helper.createRelations([
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "depends_on",
          strength: 0.7,
          confidence: 0.85,
        },
      ])

      ok(result[0].strength !== undefined)
      ok(result[0].confidence !== undefined)
    })

    it("should create relation with metadata", async () => {
      const entities = [
        createTestEntity("feature"),
        createTestEntity("decision"),
      ]
      await helper.createEntities(entities)

      const result = await helper.createRelations([
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "implements",
          metadata: {
            source: "architecture-diagram",
            tags: ["critical", "production"],
          },
        },
      ])

      ok(result[0].metadata)
    })

    it("should create relation with all optional parameters", async () => {
      const entities = [
        createTestEntity("component"),
        createTestEntity("component"),
      ]
      await helper.createEntities(entities)

      const result = await helper.createRelations([
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "depends_on",
          strength: 0.75,
          confidence: 0.9,
          metadata: {
            source: "code-analysis",
            version: "1.0.0",
            reviewer: "architect",
          },
        },
      ])

      ok(result[0].strength !== undefined)
      ok(result[0].confidence !== undefined)
      ok(result[0].metadata)
    })

    it("should reject invalid relation type", async () => {
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      await helper.expectToolError(
        "create_relations",
        {
          relations: [
            {
              from: entities[0].name,
              to: entities[1].name,
              relationType: "invalid_type",
            },
          ],
        },
        "relationType"
      )
    })

    it("should reject missing from field", async () => {
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      await helper.expectToolError(
        "create_relations",
        {
          relations: [
            {
              to: entities[1].name,
              relationType: "relates_to",
            },
          ],
        },
        "from"
      )
    })

    it("should reject missing to field", async () => {
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      await helper.expectToolError(
        "create_relations",
        {
          relations: [
            {
              from: entities[0].name,
              relationType: "relates_to",
            },
          ],
        },
        "to"
      )
    })

    it("should reject strength value > 1.0", async () => {
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      await helper.expectToolError(
        "create_relations",
        {
          relations: [
            {
              from: entities[0].name,
              to: entities[1].name,
              relationType: "depends_on",
              strength: 1.5,
            },
          ],
        },
        "strength"
      )
    })

    it("should reject negative strength value", async () => {
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      await helper.expectToolError(
        "create_relations",
        {
          relations: [
            {
              from: entities[0].name,
              to: entities[1].name,
              relationType: "depends_on",
              strength: -0.5,
            },
          ],
        },
        "strength"
      )
    })

    it("should reject confidence value > 1.0", async () => {
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      await helper.expectToolError(
        "create_relations",
        {
          relations: [
            {
              from: entities[0].name,
              to: entities[1].name,
              relationType: "depends_on",
              confidence: 1.1,
            },
          ],
        },
        "confidence"
      )
    })

    it("should reject negative confidence value", async () => {
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      await helper.expectToolError(
        "create_relations",
        {
          relations: [
            {
              from: entities[0].name,
              to: entities[1].name,
              relationType: "depends_on",
              confidence: -0.5,
            },
          ],
        },
        "confidence"
      )
    })

    it("should accept strength of exactly 0.0", async () => {
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      const result = await helper.createRelations([
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "depends_on",
          strength: 0.0,
        },
      ])

      strictEqual(result[0].strength, 0.0)
    })

    it("should accept strength of exactly 1.0", async () => {
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      const result = await helper.createRelations([
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "depends_on",
          strength: 1.0,
        },
      ])

      strictEqual(result[0].strength, 1.0)
    })

    it("should handle self-referencing relation", async () => {
      const entity = createTestEntity("component")
      await helper.createEntities([entity])

      const result = await helper.createRelations([
        {
          from: entity.name,
          to: entity.name,
          relationType: "relates_to",
        },
      ])

      strictEqual(result[0].from, result[0].to)
    })

    it("should handle circular relations", async () => {
      const entities = [
        createTestEntity("component"),
        createTestEntity("component"),
        createTestEntity("component"),
      ]
      await helper.createEntities(entities)

      const entityNames = entities.map((e) => e.name)
      const circularRelations = createCircularRelations(entityNames)

      const result = await helper.createRelations(circularRelations)
      strictEqual(result.length, 3)
    })

    it("should reject relation to non-existent entity (from)", async () => {
      const entity = createTestEntity("feature")
      await helper.createEntities([entity])

      await helper.expectToolError(
        "create_relations",
        {
          relations: [
            {
              from: "non_existent_entity",
              to: entity.name,
              relationType: "relates_to",
            },
          ],
        },
        "not found"
      )
    })

    it("should reject relation to non-existent entity (to)", async () => {
      const entity = createTestEntity("feature")
      await helper.createEntities([entity])

      await helper.expectToolError(
        "create_relations",
        {
          relations: [
            {
              from: entity.name,
              to: "non_existent_entity",
              relationType: "relates_to",
            },
          ],
        },
        "not found"
      )
    })

    it("should handle large metadata object", async () => {
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      const result = await helper.createRelations([
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "relates_to",
          metadata: {
            description: "A".repeat(5000),
            tags: Array.from({ length: 100 }, (_, i) => `tag-${i}`),
            nested: {
              level1: {
                level2: {
                  level3: "deep nesting",
                },
              },
            },
          },
        },
      ])

      ok(result[0].metadata)
    })
  })

  describe("get_relation", () => {
    it("should retrieve existing relation", async () => {
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      await helper.createRelations([
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "relates_to",
        },
      ])

      const result = await helper.getRelation(
        entities[0].name,
        entities[1].name,
        "relates_to"
      )

      ok(result, "should return result")
      strictEqual(result.from, entities[0].name)
      strictEqual(result.to, entities[1].name)
      strictEqual(result.relationType, "relates_to")
    })

    it("should retrieve relation with strength", async () => {
      const entities = [
        createTestEntity("component"),
        createTestEntity("component"),
      ]
      await helper.createEntities(entities)

      await helper.createRelations([
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "depends_on",
          strength: 0.8,
        },
      ])

      const result = await helper.getRelation(
        entities[0].name,
        entities[1].name,
        "depends_on"
      )

      ok(result.strength !== undefined)
    })

    it("should retrieve relation with metadata", async () => {
      const entities = [
        createTestEntity("feature"),
        createTestEntity("decision"),
      ]
      await helper.createEntities(entities)

      await helper.createRelations([
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "implements",
          metadata: { source: "test" },
        },
      ])

      const result = await helper.getRelation(
        entities[0].name,
        entities[1].name,
        "implements"
      )

      ok(result.metadata)
    })

    it("should handle get_relation for non-existent relation", async () => {
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      await helper.expectToolError(
        "get_relation",
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "relates_to",
        },
        "not found"
      )
    })

    it("should distinguish between different relation types", async () => {
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      // Create depends_on relation
      await helper.createRelations([
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "depends_on",
        },
      ])

      // Try to get relates_to (should fail)
      await helper.expectToolError(
        "get_relation",
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "relates_to",
        },
        "not found"
      )
    })

    it("should handle get_relation with non-existent from entity", async () => {
      await helper.expectToolError(
        "get_relation",
        {
          from: "non_existent_from",
          to: "non_existent_to",
          relationType: "relates_to",
        },
        "not found"
      )
    })

    it("should verify relation direction matters", async () => {
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      await helper.createRelations([
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "depends_on",
        },
      ])

      // Getting reverse direction should fail
      await helper.expectToolError(
        "get_relation",
        {
          from: entities[1].name,
          to: entities[0].name,
          relationType: "depends_on",
        },
        "not found"
      )
    })
  })

  describe("update_relation", () => {
    it("should update relation strength", async () => {
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      await helper.createRelations([
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "relates_to",
          strength: 0.5,
        },
      ])

      const result = await helper.callToolJSON("update_relation", {
        relation: {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "relates_to",
          strength: 0.9,
        },
      })

      ok(result, "should return result")

      // Verify update
      const updated = await helper.getRelation(
        entities[0].name,
        entities[1].name,
        "relates_to"
      )
      ok(Math.abs(updated.strength - 0.9) < 0.01, "strength should be updated")
    })

    it("should update relation confidence", async () => {
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      await helper.createRelations([
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "relates_to",
          confidence: 0.6,
        },
      ])

      await helper.callToolJSON("update_relation", {
        relation: {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "relates_to",
          confidence: 0.95,
        },
      })

      const updated = await helper.getRelation(
        entities[0].name,
        entities[1].name,
        "relates_to"
      )
      ok(
        Math.abs(updated.confidence - 0.95) < 0.01,
        "confidence should be updated"
      )
    })

    it("should update relation metadata", async () => {
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      await helper.createRelations([
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "relates_to",
          metadata: { version: "1.0.0" },
        },
      ])

      await helper.callToolJSON("update_relation", {
        relation: {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "relates_to",
          metadata: { version: "2.0.0", updated: true },
        },
      })

      const updated = await helper.getRelation(
        entities[0].name,
        entities[1].name,
        "relates_to"
      )
      ok(updated.metadata)
    })

    it("should update multiple properties at once", async () => {
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      await helper.createRelations([
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "relates_to",
          strength: 0.5,
          confidence: 0.6,
        },
      ])

      await helper.callToolJSON("update_relation", {
        relation: {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "relates_to",
          strength: 0.9,
          confidence: 0.95,
          metadata: { updated: true },
        },
      })

      const updated = await helper.getRelation(
        entities[0].name,
        entities[1].name,
        "relates_to"
      )
      ok(Math.abs(updated.strength - 0.9) < 0.01)
      ok(Math.abs(updated.confidence - 0.95) < 0.01)
    })

    it("should reject update to non-existent relation", async () => {
      await helper.expectToolError(
        "update_relation",
        {
          relation: {
            from: "non_existent_from",
            to: "non_existent_to",
            relationType: "relates_to",
            strength: 0.8,
          },
        },
        "not found"
      )
    })

    it("should reject invalid strength in update", async () => {
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      await helper.createRelations([
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "relates_to",
        },
      ])

      await helper.expectToolError(
        "update_relation",
        {
          relation: {
            from: entities[0].name,
            to: entities[1].name,
            relationType: "relates_to",
            strength: 1.5,
          },
        },
        "strength"
      )
    })
  })

  describe("delete_relations", () => {
    it("should delete a single relation", async () => {
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      await helper.createRelations([
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "relates_to",
        },
      ])

      const result = await helper.callToolJSON("delete_relations", {
        relations: [
          {
            from: entities[0].name,
            to: entities[1].name,
            relationType: "relates_to",
          },
        ],
      })

      ok(result, "should return result")

      // Verify deletion
      await helper.expectToolError(
        "get_relation",
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "relates_to",
        },
        "not found"
      )
    })

    it("should delete multiple relations in batch", async () => {
      const entities = [
        createTestEntity("feature"),
        createTestEntity("task"),
        createTestEntity("component"),
      ]
      await helper.createEntities(entities)

      await helper.createRelations([
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "relates_to",
        },
        {
          from: entities[1].name,
          to: entities[2].name,
          relationType: "depends_on",
        },
      ])

      await helper.callToolJSON("delete_relations", {
        relations: [
          {
            from: entities[0].name,
            to: entities[1].name,
            relationType: "relates_to",
          },
          {
            from: entities[1].name,
            to: entities[2].name,
            relationType: "depends_on",
          },
        ],
      })

      // Verify both are deleted
      const graph = await helper.readGraph()
      strictEqual(graph.relations.length, 0)
    })

    it("should handle deleting non-existent relation gracefully", async () => {
      const result = await helper.callToolJSON("delete_relations", {
        relations: [
          {
            from: "non_existent_from",
            to: "non_existent_to",
            relationType: "relates_to",
          },
        ],
      })

      ok(result, "should not throw error")
    })

    it("should preserve other relations when deleting specific one", async () => {
      const entities = [
        createTestEntity("feature"),
        createTestEntity("task"),
        createTestEntity("component"),
      ]
      await helper.createEntities(entities)

      await helper.createRelations([
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "relates_to",
        },
        {
          from: entities[1].name,
          to: entities[2].name,
          relationType: "depends_on",
        },
      ])

      // Delete only first relation
      await helper.callToolJSON("delete_relations", {
        relations: [
          {
            from: entities[0].name,
            to: entities[1].name,
            relationType: "relates_to",
          },
        ],
      })

      // Verify second relation still exists
      const remainingRelation = await helper.getRelation(
        entities[1].name,
        entities[2].name,
        "depends_on"
      )
      ok(remainingRelation)
    })

    it("should handle mixed valid and invalid relations in batch delete", async () => {
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      await helper.createRelations([
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "relates_to",
        },
      ])

      // Delete both existing and non-existing
      const result = await helper.callToolJSON("delete_relations", {
        relations: [
          {
            from: entities[0].name,
            to: entities[1].name,
            relationType: "relates_to",
          },
          {
            from: "non_existent",
            to: "non_existent",
            relationType: "relates_to",
          },
        ],
      })

      ok(result)
    })
  })
})
