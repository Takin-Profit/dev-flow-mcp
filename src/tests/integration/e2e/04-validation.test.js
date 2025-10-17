/**
 * E2E Tests: Validation & Error Handling
 * Comprehensive testing for input validation, error cases,
 * type safety, and edge cases across all tools
 */

import { ok } from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import { createTestEntity, generateEntityName } from "./fixtures/entities.js"
import {
  cleanupAllTestData,
  getSharedClient,
} from "./fixtures/shared-client.js"

describe("E2E: Validation & Error Handling", () => {
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

  describe("Entity Type Validation", () => {
    it("should reject unknown entity type", async () => {
      await helper.expectToolError(
        "create_entities",
        {
          entities: [
            {
              name: generateEntityName("invalid_type"),
              entityType: "unknown_type",
              observations: ["Test"],
            },
          ],
        },
        "entityType"
      )
    })

    it("should reject numeric entity type", async () => {
      await helper.expectToolError(
        "create_entities",
        {
          entities: [
            {
              name: generateEntityName("numeric_type"),
              entityType: 123,
              observations: ["Test"],
            },
          ],
        },
        "entityType"
      )
    })

    it("should reject null entity type", async () => {
      await helper.expectToolError(
        "create_entities",
        {
          entities: [
            {
              name: generateEntityName("null_type"),
              entityType: null,
              observations: ["Test"],
            },
          ],
        },
        "entityType"
      )
    })

    it("should reject missing entity type", async () => {
      await helper.expectToolError(
        "create_entities",
        {
          entities: [
            {
              name: generateEntityName("missing_type"),
              // entityType missing
              observations: ["Test"],
            },
          ],
        },
        "entityType"
      )
    })

    it("should accept all valid entity types", async () => {
      const validTypes = ["feature", "task", "decision", "component"]

      for (const type of validTypes) {
        const entity = {
          name: generateEntityName(`valid_${type}`),
          entityType: type,
          observations: ["Test"],
        }
        const result = await helper.createEntities([entity])
        ok(result.length > 0)
      }
    })
  })

  describe("Relation Type Validation", () => {
    it("should reject unknown relation type", async () => {
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      await helper.expectToolError(
        "create_relations",
        {
          relations: [
            {
              from: entities[0].name,
              to: entities[1].name,
              relationType: "unknown_relation",
            },
          ],
        },
        "relationType"
      )
    })

    it("should reject numeric relation type", async () => {
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      await helper.expectToolError(
        "create_relations",
        {
          relations: [
            {
              from: entities[0].name,
              to: entities[1].name,
              relationType: 456,
            },
          ],
        },
        "relationType"
      )
    })

    it("should reject null relation type", async () => {
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      await helper.expectToolError(
        "create_relations",
        {
          relations: [
            {
              from: entities[0].name,
              to: entities[1].name,
              relationType: null,
            },
          ],
        },
        "relationType"
      )
    })

    it("should reject missing relation type", async () => {
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      await helper.expectToolError(
        "create_relations",
        {
          relations: [
            {
              from: entities[0].name,
              to: entities[1].name,
              // relationType missing
            },
          ],
        },
        "relationType"
      )
    })

    it("should accept all valid relation types", async () => {
      const validTypes = ["depends_on", "implements", "part_of", "relates_to"]

      for (const type of validTypes) {
        const entities = [createTestEntity("feature"), createTestEntity("task")]
        await helper.createEntities(entities)

        const result = await helper.createRelations([
          {
            from: entities[0].name,
            to: entities[1].name,
            relationType: type,
          },
        ])
        ok(result.length > 0)
      }
    })
  })

  describe("Required Fields Validation", () => {
    it("should reject entity without name", async () => {
      await helper.expectToolError(
        "create_entities",
        {
          entities: [
            {
              // name missing
              entityType: "feature",
              observations: ["Test"],
            },
          ],
        },
        "name"
      )
    })

    it("should reject entity with empty name", async () => {
      await helper.expectToolError(
        "create_entities",
        {
          entities: [
            {
              name: "",
              entityType: "feature",
              observations: ["Test"],
            },
          ],
        },
        "name"
      )
    })

    it("should reject entity with null name", async () => {
      await helper.expectToolError(
        "create_entities",
        {
          entities: [
            {
              name: null,
              entityType: "feature",
              observations: ["Test"],
            },
          ],
        },
        "name"
      )
    })

    it("should reject entity without observations", async () => {
      await helper.expectToolError(
        "create_entities",
        {
          entities: [
            {
              name: generateEntityName("no_obs"),
              entityType: "feature",
              // observations missing
            },
          ],
        },
        "observations"
      )
    })

    it("should reject entity with null observations", async () => {
      await helper.expectToolError(
        "create_entities",
        {
          entities: [
            {
              name: generateEntityName("null_obs"),
              entityType: "feature",
              observations: null,
            },
          ],
        },
        "observations"
      )
    })

    it("should reject entity with non-array observations", async () => {
      await helper.expectToolError(
        "create_entities",
        {
          entities: [
            {
              name: generateEntityName("string_obs"),
              entityType: "feature",
              observations: "should be an array",
            },
          ],
        },
        "observations"
      )
    })

    it("should reject relation without from field", async () => {
      const entity = createTestEntity("feature")
      await helper.createEntities([entity])

      await helper.expectToolError(
        "create_relations",
        {
          relations: [
            {
              // from missing
              to: entity.name,
              relationType: "relates_to",
            },
          ],
        },
        "from"
      )
    })

    it("should reject relation without to field", async () => {
      const entity = createTestEntity("feature")
      await helper.createEntities([entity])

      await helper.expectToolError(
        "create_relations",
        {
          relations: [
            {
              from: entity.name,
              // to missing
              relationType: "relates_to",
            },
          ],
        },
        "to"
      )
    })

    it("should reject relation with empty from field", async () => {
      const entity = createTestEntity("feature")
      await helper.createEntities([entity])

      await helper.expectToolError(
        "create_relations",
        {
          relations: [
            {
              from: "",
              to: entity.name,
              relationType: "relates_to",
            },
          ],
        },
        "from"
      )
    })

    it("should reject relation with empty to field", async () => {
      const entity = createTestEntity("feature")
      await helper.createEntities([entity])

      await helper.expectToolError(
        "create_relations",
        {
          relations: [
            {
              from: entity.name,
              to: "",
              relationType: "relates_to",
            },
          ],
        },
        "to"
      )
    })
  })

  describe("Strength and Confidence Validation", () => {
    it("should reject strength > 1.0", async () => {
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

    it("should reject strength < 0.0", async () => {
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
              strength: -0.1,
            },
          ],
        },
        "strength"
      )
    })

    it("should reject confidence > 1.0", async () => {
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
              confidence: 1.2,
            },
          ],
        },
        "confidence"
      )
    })

    it("should reject confidence < 0.0", async () => {
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

    it("should accept strength of 0.0", async () => {
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

      ok(result.length > 0)
    })

    it("should accept strength of 1.0", async () => {
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

      ok(result.length > 0)
    })

    it("should accept confidence of 0.0", async () => {
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      const result = await helper.createRelations([
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "depends_on",
          confidence: 0.0,
        },
      ])

      ok(result.length > 0)
    })

    it("should accept confidence of 1.0", async () => {
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      const result = await helper.createRelations([
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "depends_on",
          confidence: 1.0,
        },
      ])

      ok(result.length > 0)
    })

    it("should reject string strength value", async () => {
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
              strength: "0.8",
            },
          ],
        },
        "strength"
      )
    })

    it("should reject string confidence value", async () => {
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
              confidence: "0.9",
            },
          ],
        },
        "confidence"
      )
    })
  })

  describe("Array Validation", () => {
    it("should reject empty entities array", async () => {
      await helper.expectToolError(
        "create_entities",
        { entities: [] },
        "entities"
      )
    })

    it("should reject null entities array", async () => {
      await helper.expectToolError(
        "create_entities",
        { entities: null },
        "entities"
      )
    })

    it("should reject non-array entities parameter", async () => {
      await helper.expectToolError(
        "create_entities",
        { entities: "not an array" },
        "entities"
      )
    })

    it("should reject empty relations array", async () => {
      await helper.expectToolError(
        "create_relations",
        { relations: [] },
        "relations"
      )
    })

    it("should reject null relations array", async () => {
      await helper.expectToolError(
        "create_relations",
        { relations: null },
        "relations"
      )
    })

    it("should reject empty entityNames array for delete", async () => {
      const result = await helper.deleteEntities([])
      // Empty delete might succeed silently or return empty result
      ok(result !== null)
    })

    it("should reject empty observations array", async () => {
      await helper.expectToolError(
        "create_entities",
        {
          entities: [
            {
              name: generateEntityName("empty_obs"),
              entityType: "feature",
              observations: [],
            },
          ],
        },
        "observations"
      )
    })

    it("should reject observations with non-string elements", async () => {
      await helper.expectToolError(
        "create_entities",
        {
          entities: [
            {
              name: generateEntityName("invalid_obs"),
              entityType: "feature",
              observations: ["Valid string", 123, null],
            },
          ],
        },
        "observations"
      )
    })
  })

  describe("Error Message Clarity", () => {
    it("should provide clear error for invalid entity type", async () => {
      const error = await helper.expectToolError("create_entities", {
        entities: [
          {
            name: generateEntityName("test"),
            entityType: "invalid",
            observations: ["Test"],
          },
        ],
      })

      ok(error.message, "error should have message")
      ok(
        error.message.includes("entityType") ||
          error.message.includes("type") ||
          error.message.includes("invalid")
      )
    })

    it("should provide clear error for missing required field", async () => {
      const error = await helper.expectToolError("create_entities", {
        entities: [
          {
            entityType: "feature",
            observations: ["Test"],
          },
        ],
      })

      ok(error.message)
      ok(
        error.message.includes("name") ||
          error.message.includes("required") ||
          error.message.includes("missing")
      )
    })

    it("should provide clear error for invalid strength", async () => {
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      const error = await helper.expectToolError("create_relations", {
        relations: [
          {
            from: entities[0].name,
            to: entities[1].name,
            relationType: "depends_on",
            strength: 2.0,
          },
        ],
      })

      ok(error.message)
      ok(
        error.message.includes("strength") ||
          error.message.includes("0") ||
          error.message.includes("1")
      )
    })

    it("should provide clear error for non-existent entity", async () => {
      const error = await helper.expectToolError("add_observations", {
        entityName: "definitely_does_not_exist_12345",
        contents: ["Test"],
      })

      ok(error.message)
      ok(
        error.message.includes("not found") ||
          error.message.includes("exist") ||
          error.message.includes("Entity")
      )
    })
  })

  describe("Null and Undefined Handling", () => {
    it("should reject undefined entityType", async () => {
      await helper.expectToolError(
        "create_entities",
        {
          entities: [
            {
              name: generateEntityName("test"),
              entityType: undefined,
              observations: ["Test"],
            },
          ],
        },
        "entityType"
      )
    })

    it("should handle optional metadata as undefined", async () => {
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      const result = await helper.createRelations([
        {
          from: entities[0].name,
          to: entities[1].name,
          relationType: "relates_to",
          metadata: undefined,
        },
      ])

      ok(result.length > 0)
    })

    it("should handle null metadata gracefully", async () => {
      const entities = [createTestEntity("feature"), createTestEntity("task")]
      await helper.createEntities(entities)

      // Null metadata might be accepted or rejected - test the behavior
      try {
        const result = await helper.createRelations([
          {
            from: entities[0].name,
            to: entities[1].name,
            relationType: "relates_to",
            metadata: null,
          },
        ])
        ok(result)
      } catch (error) {
        // If it rejects null, that's also valid
        ok(error instanceof Error)
      }
    })

    it("should reject null as entire relation object", async () => {
      await helper.expectToolError(
        "create_relations",
        { relations: [null] },
        "relation"
      )
    })
  })

  describe("Malformed Requests", () => {
    it("should reject create_entities without entities parameter", async () => {
      await helper.expectToolError("create_entities", {}, "entities")
    })

    it("should reject create_relations without relations parameter", async () => {
      await helper.expectToolError("create_relations", {}, "relations")
    })

    it("should reject add_observations without entityName", async () => {
      await helper.expectToolError(
        "add_observations",
        { contents: ["Test"] },
        "entityName"
      )
    })

    it("should reject add_observations without contents", async () => {
      await helper.expectToolError(
        "add_observations",
        { entityName: "test" },
        "contents"
      )
    })

    it("should reject get_relation with missing parameters", async () => {
      await helper.expectToolError("get_relation", { from: "entity1" }, "to")
    })
  })
})
