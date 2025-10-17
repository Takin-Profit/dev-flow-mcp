/**
 * E2E Tests: CRUD Operations
 * Comprehensive testing for create_entities, read_graph, delete_entities,
 * add_observations, and delete_observations
 */

import { ok, strictEqual } from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import {
  createTestEntities,
  createTestEntity,
  edgeCaseEntities,
  generateEntityName,
  validEntities,
} from "./fixtures/entities.js"
import {
  cleanupAllTestData,
  getSharedClient,
} from "./fixtures/shared-client.js"

describe("E2E: CRUD Operations", () => {
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

  describe("create_entities", () => {
    it("should create a single valid entity", async () => {
      const entity = createTestEntity("feature")
      const result = await helper.createEntities([entity])

      ok(result, "should return result")
      ok(Array.isArray(result), "result should be an array")
      strictEqual(result.length, 1, "should create 1 entity")
      strictEqual(result[0].name, entity.name)
    })

    it("should create multiple entities in batch", async () => {
      const entities = [
        createTestEntity("feature"),
        createTestEntity("task"),
        createTestEntity("decision"),
        createTestEntity("component"),
      ]

      const result = await helper.createEntities(entities)

      ok(Array.isArray(result), "result should be an array")
      strictEqual(result.length, 4, "should create 4 entities")
    })

    it("should create feature entity type", async () => {
      const result = await helper.createEntities([validEntities.feature])
      strictEqual(result[0].entityType, "feature")
    })

    it("should create task entity type", async () => {
      const result = await helper.createEntities([validEntities.task])
      strictEqual(result[0].entityType, "task")
    })

    it("should create decision entity type", async () => {
      const result = await helper.createEntities([validEntities.decision])
      strictEqual(result[0].entityType, "decision")
    })

    it("should create component entity type", async () => {
      const result = await helper.createEntities([validEntities.component])
      strictEqual(result[0].entityType, "component")
    })

    it("should preserve observations array", async () => {
      const entity = createTestEntity("feature", [
        "First observation",
        "Second observation",
        "Third observation",
      ])
      const result = await helper.createEntities([entity])

      strictEqual(result[0].observations.length, 3)
    })

    it("should reject invalid entity type", async () => {
      await helper.expectToolError(
        "create_entities",
        {
          entities: [
            {
              name: generateEntityName("invalid_type_test"),
              entityType: "invalid_type",
              observations: ["Test"],
            },
          ],
        },
        "entityType"
      )
    })

    it("should reject missing observations field", async () => {
      const invalidEntity = {
        name: generateEntityName("missing_obs"),
        entityType: "feature",
        // observations missing
      }

      await helper.expectToolError(
        "create_entities",
        { entities: [invalidEntity] },
        "observations"
      )
    })

    it("should reject empty observations array", async () => {
      const entity = {
        name: generateEntityName("empty_obs"),
        entityType: "feature",
        observations: [],
      }

      await helper.expectToolError(
        "create_entities",
        { entities: [entity] },
        "observations"
      )
    })

    it("should handle entity with special characters in name", async () => {
      const entity = {
        ...edgeCaseEntities.specialChars,
        name: generateEntityName("special_chars"),
      }
      const result = await helper.createEntities([entity])

      strictEqual(result.length, 1)
      ok(result[0].name.includes("special_chars"))
    })

    it("should handle entity with unicode characters", async () => {
      const entity = {
        ...edgeCaseEntities.unicode,
        name: generateEntityName("unicode_日本語_🚀"),
      }
      const result = await helper.createEntities([entity])

      strictEqual(result.length, 1)
      ok(result[0].name.includes("unicode"))
    })

    it("should handle entity with very long name", async () => {
      const longName = `${generateEntityName("long")}_${"a".repeat(400)}`
      const entity = {
        name: longName,
        entityType: "feature",
        observations: ["Long name test"],
      }
      const result = await helper.createEntities([entity])

      strictEqual(result.length, 1)
    })

    it("should handle entity with many observations", async () => {
      const entity = {
        ...edgeCaseEntities.manyObservations,
        name: generateEntityName("many_obs"),
      }
      const result = await helper.createEntities([entity])

      strictEqual(result.length, 1)
      strictEqual(result[0].observations.length, 100)
    })

    it("should handle entity with very long observation", async () => {
      const entity = {
        name: generateEntityName("long_obs"),
        entityType: "feature",
        observations: ["A".repeat(5000)],
      }
      const result = await helper.createEntities([entity])

      strictEqual(result.length, 1)
      ok(result[0].observations[0].length > 4000)
    })

    it("should handle duplicate entity creation gracefully", async () => {
      const entity = createTestEntity("feature")
      await helper.createEntities([entity])

      // Try to create the same entity again
      try {
        await helper.createEntities([entity])
        // If it doesn't throw, that's okay - it might merge or update
      } catch (error) {
        // If it throws, verify it's a meaningful error
        ok(error instanceof Error)
        ok(
          error.message.includes("exists") ||
            error.message.includes("duplicate") ||
            error.message.includes("already")
        )
      }
    })
  })

  describe("read_graph", () => {
    before(async () => {
      // Clean up before read_graph tests
      const graph = await helper.readGraph()
      if (graph.entities.length > 0) {
        const entityNames = graph.entities.map((e) => e.name)
        await helper.deleteEntities(entityNames)
      }
    })

    it("should return empty graph when no entities exist", async () => {
      const result = await helper.readGraph()

      ok(result, "should return result")
      ok(Array.isArray(result.entities), "entities should be an array")
      ok(Array.isArray(result.relations), "relations should be an array")
      strictEqual(result.entities.length, 0, "should have 0 entities")
    })

    it("should return graph with entities only", async () => {
      const entities = createTestEntities(3, "feature")
      await helper.createEntities(entities)

      const result = await helper.readGraph()

      strictEqual(result.entities.length, 3)
      strictEqual(result.relations.length, 0)
    })

    it("should return graph with entities and relations", async () => {
      // Clean first
      const graph = await helper.readGraph()
      if (graph.entities.length > 0) {
        const entityNames = graph.entities.map((e) => e.name)
        await helper.deleteEntities(entityNames)
      }

      // Create entities
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      // Create relation
      await helper.createRelations([
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "relates_to",
        },
      ])

      const result = await helper.readGraph()

      strictEqual(result.entities.length, 2)
      strictEqual(result.relations.length, 1)
    })

    it("should handle large graph with many entities", async () => {
      // Clean first
      const graph = await helper.readGraph()
      if (graph.entities.length > 0) {
        const entityNames = graph.entities.map((e) => e.name)
        await helper.deleteEntities(entityNames)
      }

      const entities = createTestEntities(50, "component")
      await helper.createEntities(entities)

      const result = await helper.readGraph()

      ok(result.entities.length >= 50)
    })

    it("should include all entity properties", async () => {
      // Clean first
      const graph = await helper.readGraph()
      if (graph.entities.length > 0) {
        const entityNames = graph.entities.map((e) => e.name)
        await helper.deleteEntities(entityNames)
      }

      const entity = createTestEntity("feature", [
        "Observation 1",
        "Observation 2",
      ])
      await helper.createEntities([entity])

      const result = await helper.readGraph()

      strictEqual(result.entities.length, 1)
      ok(result.entities[0].name)
      ok(result.entities[0].entityType)
      ok(Array.isArray(result.entities[0].observations))
      strictEqual(result.entities[0].observations.length, 2)
    })
  })

  describe("delete_entities", () => {
    it("should delete a single entity", async () => {
      const entity = createTestEntity("feature")
      await helper.createEntities([entity])

      const result = await helper.deleteEntities([entity.name])

      ok(result, "should return result")
      ok(
        result.success || result.deleted || Array.isArray(result),
        "should indicate success"
      )

      // Verify deletion
      const graph = await helper.readGraph()
      const stillExists = graph.entities.some((e) => e.name === entity.name)
      strictEqual(stillExists, false, "entity should be deleted")
    })

    it("should delete multiple entities in batch", async () => {
      const entities = createTestEntities(3, "task")
      await helper.createEntities(entities)

      const entityNames = entities.map((e) => e.name)
      await helper.deleteEntities(entityNames)

      // Verify deletion
      const graph = await helper.readGraph()
      for (const name of entityNames) {
        const stillExists = graph.entities.some((e) => e.name === name)
        strictEqual(stillExists, false, `entity ${name} should be deleted`)
      }
    })

    it("should handle deleting non-existent entity gracefully", async () => {
      const nonExistentName = generateEntityName("non_existent")

      // Should not throw error
      const result = await helper.deleteEntities([nonExistentName])
      ok(result, "should return result")
    })

    it("should cascade delete relations when entity is deleted", async () => {
      // Create two entities and a relation
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      await helper.createRelations([
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "relates_to",
        },
      ])

      // Verify relation exists
      let graph = await helper.readGraph()
      strictEqual(graph.relations.length, 1)

      // Delete one entity
      await helper.deleteEntities([entities[0].name])

      // Verify relation is also deleted
      graph = await helper.readGraph()
      const relationStillExists = graph.relations.some(
        (r) => r.from === entities[0].name || r.to === entities[0].name
      )
      strictEqual(
        relationStillExists,
        false,
        "relation should be cascade deleted"
      )
    })

    it("should handle mixed valid and invalid entity names", async () => {
      const validEntity = createTestEntity("feature")
      await helper.createEntities([validEntity])

      const nonExistentName = generateEntityName("non_existent")

      // Should handle mixed batch without failing
      const result = await helper.deleteEntities([
        validEntity.name,
        nonExistentName,
      ])
      ok(result, "should return result")
    })

    it("should verify graph state after deletion", async () => {
      // Create 5 entities
      const entities = createTestEntities(5, "component")
      await helper.createEntities(entities)

      // Delete 2 entities
      await helper.deleteEntities([entities[0].name, entities[1].name])

      // Verify only 3 remain
      const graph = await helper.readGraph()
      const remainingTestEntities = graph.entities.filter((e) =>
        entities.slice(2).some((entity) => entity.name === e.name)
      )
      strictEqual(remainingTestEntities.length, 3)
    })

    it("should handle deleting all entities", async () => {
      const entities = createTestEntities(10, "task")
      await helper.createEntities(entities)

      const entityNames = entities.map((e) => e.name)
      await helper.deleteEntities(entityNames)

      const graph = await helper.readGraph()
      strictEqual(graph.entities.length, 0, "all entities should be deleted")
    })
  })

  describe("add_observations", () => {
    it("should add single observation to existing entity", async () => {
      const entity = createTestEntity("feature", ["Initial observation"])
      await helper.createEntities([entity])

      const result = await helper.callToolJSON("add_observations", {
        entityName: entity.name,
        contents: ["New observation"],
      })

      ok(result, "should return result")

      // Verify observation was added
      const graph = await helper.readGraph()
      const updatedEntity = graph.entities.find((e) => e.name === entity.name)
      ok(updatedEntity, "entity should exist")
      ok(
        updatedEntity.observations.length >= 2,
        "should have at least 2 observations"
      )
    })

    it("should add multiple observations at once", async () => {
      const entity = createTestEntity("task", ["Initial observation"])
      await helper.createEntities([entity])

      await helper.callToolJSON("add_observations", {
        entityName: entity.name,
        contents: ["Observation 2", "Observation 3", "Observation 4"],
      })

      const graph = await helper.readGraph()
      const updatedEntity = graph.entities.find((e) => e.name === entity.name)
      ok(
        updatedEntity.observations.length >= 4,
        "should have at least 4 observations"
      )
    })

    it("should reject adding to non-existent entity", async () => {
      const nonExistentName = generateEntityName("non_existent")

      await helper.expectToolError(
        "add_observations",
        {
          entityName: nonExistentName,
          contents: ["Test observation"],
        },
        "not found"
      )
    })

    it("should reject empty observations array", async () => {
      const entity = createTestEntity("feature")
      await helper.createEntities([entity])

      await helper.expectToolError(
        "add_observations",
        {
          entityName: entity.name,
          contents: [],
        },
        "contents"
      )
    })

    it("should handle duplicate observation", async () => {
      const entity = createTestEntity("decision", ["Duplicate observation"])
      await helper.createEntities([entity])

      // Add the same observation again
      await helper.callToolJSON("add_observations", {
        entityName: entity.name,
        contents: ["Duplicate observation"],
      })

      const graph = await helper.readGraph()
      const updatedEntity = graph.entities.find((e) => e.name === entity.name)

      // System might allow or prevent duplicates - both are valid
      ok(updatedEntity.observations.length >= 1)
    })

    it("should handle very long observation text", async () => {
      const entity = createTestEntity("component")
      await helper.createEntities([entity])

      const longObservation = "A".repeat(10_000)
      await helper.callToolJSON("add_observations", {
        entityName: entity.name,
        contents: [longObservation],
      })

      const graph = await helper.readGraph()
      const updatedEntity = graph.entities.find((e) => e.name === entity.name)
      ok(
        updatedEntity.observations.some((obs) => obs.length > 9000),
        "should store long observation"
      )
    })

    it("should preserve existing observations when adding new ones", async () => {
      const entity = createTestEntity("feature", [
        "Original observation 1",
        "Original observation 2",
      ])
      await helper.createEntities([entity])

      await helper.callToolJSON("add_observations", {
        entityName: entity.name,
        contents: ["New observation"],
      })

      const graph = await helper.readGraph()
      const updatedEntity = graph.entities.find((e) => e.name === entity.name)
      ok(
        updatedEntity.observations.some((obs) =>
          obs.includes("Original observation 1")
        )
      )
      ok(
        updatedEntity.observations.some((obs) =>
          obs.includes("Original observation 2")
        )
      )
    })
  })

  describe("delete_observations", () => {
    it("should delete specific observation from entity", async () => {
      const entity = createTestEntity("feature", [
        "Keep this",
        "Delete this",
        "Keep this too",
      ])
      await helper.createEntities([entity])

      await helper.callToolJSON("delete_observations", {
        deletions: [
          {
            entityName: entity.name,
            observations: ["Delete this"],
          },
        ],
      })

      const graph = await helper.readGraph()
      const updatedEntity = graph.entities.find((e) => e.name === entity.name)
      strictEqual(updatedEntity.observations.length, 2)
      ok(!updatedEntity.observations.includes("Delete this"))
    })

    it("should delete multiple observations at once", async () => {
      const entity = createTestEntity("task", [
        "Observation 1",
        "Observation 2",
        "Observation 3",
        "Observation 4",
      ])
      await helper.createEntities([entity])

      await helper.callToolJSON("delete_observations", {
        entityName: entity.name,
        observations: ["Observation 2", "Observation 4"],
      })

      const graph = await helper.readGraph()
      const updatedEntity = graph.entities.find((e) => e.name === entity.name)
      strictEqual(updatedEntity.observations.length, 2)
    })

    it("should reject deleting from non-existent entity", async () => {
      const nonExistentName = generateEntityName("non_existent")

      await helper.expectToolError(
        "delete_observations",
        {
          entityName: nonExistentName,
          observations: ["Test"],
        },
        "not found"
      )
    })

    it("should handle deleting non-existent observation gracefully", async () => {
      const entity = createTestEntity("decision", ["Existing observation"])
      await helper.createEntities([entity])

      // Should not throw error for non-existent observation
      await helper.callToolJSON("delete_observations", {
        entityName: entity.name,
        observations: ["Non-existent observation"],
      })

      const graph = await helper.readGraph()
      const updatedEntity = graph.entities.find((e) => e.name === entity.name)
      strictEqual(updatedEntity.observations.length, 1)
    })

    it("should handle deleting all observations", async () => {
      const entity = createTestEntity("component", ["Obs 1", "Obs 2", "Obs 3"])
      await helper.createEntities([entity])

      await helper.callToolJSON("delete_observations", {
        entityName: entity.name,
        observations: ["Obs 1", "Obs 2", "Obs 3"],
      })

      const graph = await helper.readGraph()
      const updatedEntity = graph.entities.find((e) => e.name === entity.name)

      // Entity might still exist with no observations, or might be deleted
      if (updatedEntity) {
        strictEqual(updatedEntity.observations.length, 0)
      }
    })
  })
})
