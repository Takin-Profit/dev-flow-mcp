/**
 * E2E Tests: Temporal Features
 * Tests get_entity_history, get_relation_history, get_graph_at_time, get_decayed_graph
 */

import { ok, strictEqual } from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import { sleep } from "./fixtures/helpers.js"
import {
  cleanupAllTestData,
  getSharedClient,
} from "./fixtures/shared-client.js"

describe("E2E: Temporal Features", () => {
  let helper

  before(async () => {
    const shared = await getSharedClient()
    helper = shared.helper
    await cleanupAllTestData()
  })

  after(async () => {
    await cleanupAllTestData()
  })

  // ==========================================================================
  // Test Group 1: get_entity_history
  // ==========================================================================

  describe("get_entity_history", () => {
    it("should return entity history with multiple versions", async () => {
      // Create entity
      const entityName = `history_test_${Date.now()}`
      await helper.createEntities([
        {
          name: entityName,
          entityType: "feature",
          observations: ["Initial observation"],
        },
      ])

      // Update entity multiple times
      await helper.callToolJSON("add_observations", {
        observations: [
          {
            entityName,
            contents: ["Second observation"],
          },
        ],
      })

      await helper.callToolJSON("add_observations", {
        observations: [
          {
            entityName,
            contents: ["Third observation"],
          },
        ],
      })

      // Get history
      const result = await helper.callToolJSON("get_entity_history", {
        entityName,
      })

      // Verify structure
      ok(result.history, "should have history property")
      ok(Array.isArray(result.history), "history should be an array")
      ok(result.history.length >= 1, "should have at least 1 version")

      // Verify chronological order (newest first by version)
      for (let i = 1; i < result.history.length; i++) {
        ok(
          result.history[i - 1].version >= result.history[i].version,
          "versions should be in descending order"
        )
      }

      // Verify required temporal fields
      result.history.forEach((version) => {
        ok(version.name, "should have name")
        ok(typeof version.version === "number", "should have version number")
        ok(
          typeof version.createdAt === "number",
          "should have createdAt timestamp"
        )
        ok(
          typeof version.updatedAt === "number",
          "should have updatedAt timestamp"
        )
        ok(
          typeof version.validFrom === "number",
          "should have validFrom timestamp"
        )
        // validTo and changedBy are optional
      })
    })

    it("should handle entity with single version", async () => {
      const entityName = `single_version_${Date.now()}`
      await helper.createEntities([
        {
          name: entityName,
          entityType: "task",
          observations: ["Single observation"],
        },
      ])

      const result = await helper.callToolJSON("get_entity_history", {
        entityName,
      })

      ok(Array.isArray(result.history), "history should be an array")
      ok(result.history.length >= 1, "should have at least 1 version")

      const version = result.history[0]
      strictEqual(version.name, entityName)
      strictEqual(version.version, 1)
    })

    it("should handle non-existent entity gracefully", async () => {
      await helper.expectToolError(
        "get_entity_history",
        { entityName: `nonexistent_entity_${Date.now()}` },
        "not found"
      )
    })

    it("should include all required temporal metadata fields", async () => {
      const entityName = `metadata_test_${Date.now()}`
      await helper.createEntities([
        {
          name: entityName,
          entityType: "component",
          observations: ["Test observation"],
        },
      ])

      const result = await helper.callToolJSON("get_entity_history", {
        entityName,
      })

      const version = result.history[0]

      // Required fields
      ok(typeof version.name === "string", "should have string name")
      ok(typeof version.version === "number", "should have number version")
      ok(typeof version.createdAt === "number", "should have number createdAt")
      ok(typeof version.updatedAt === "number", "should have number updatedAt")
      ok(typeof version.validFrom === "number", "should have number validFrom")

      // Timestamps should be reasonable (within last minute)
      const now = Date.now()
      ok(version.createdAt <= now, "createdAt should be in the past")
      ok(
        version.createdAt > now - 60_000,
        "createdAt should be within last minute"
      )
      ok(version.validFrom <= now, "validFrom should be in the past")
    })

    it("should preserve entity type across versions", async () => {
      const entityName = `type_test_${Date.now()}`
      await helper.createEntities([
        {
          name: entityName,
          entityType: "decision",
          observations: ["Initial observation"],
        },
      ])

      await helper.callToolJSON("add_observations", {
        observations: [
          {
            entityName,
            contents: ["Updated observation"],
          },
        ],
      })

      const result = await helper.callToolJSON("get_entity_history", {
        entityName,
      })

      result.history.forEach((version) => {
        strictEqual(
          version.entityType,
          "decision",
          "entity type should remain consistent"
        )
      })
    })

    it("should track observations across versions", async () => {
      const entityName = `obs_test_${Date.now()}`
      await helper.createEntities([
        {
          name: entityName,
          entityType: "feature",
          observations: ["First observation"],
        },
      ])

      await helper.callToolJSON("add_observations", {
        observations: [
          {
            entityName,
            contents: ["Second observation"],
          },
        ],
      })

      const result = await helper.callToolJSON("get_entity_history", {
        entityName,
      })

      ok(result.history.length >= 1, "should have versions")

      // Latest version should have both observations
      const latestVersion = result.history[0]
      ok(Array.isArray(latestVersion.observations), "should have observations")
      ok(
        latestVersion.observations.length >= 2,
        "should have at least 2 observations"
      )
    })

    it("should increment version numbers correctly", async () => {
      const entityName = `version_increment_${Date.now()}`
      await helper.createEntities([
        {
          name: entityName,
          entityType: "task",
          observations: ["Initial"],
        },
      ])

      // Add observations multiple times
      for (let i = 0; i < 3; i++) {
        await helper.callToolJSON("add_observations", {
          observations: [
            {
              entityName,
              contents: [`Observation ${i + 2}`],
            },
          ],
        })
      }

      const result = await helper.callToolJSON("get_entity_history", {
        entityName,
      })

      ok(result.history.length >= 1, "should have versions")

      // Check versions are sequential (starting from 1)
      const versions = result.history
        .map((v) => v.version)
        .sort((a, b) => a - b)
      strictEqual(versions[0], 1, "first version should be 1")

      // Each version should be unique
      const uniqueVersions = new Set(versions)
      strictEqual(
        uniqueVersions.size,
        versions.length,
        "all versions should be unique"
      )
    })

    it("should have updatedAt >= createdAt for all versions", async () => {
      const entityName = `timestamp_test_${Date.now()}`
      await helper.createEntities([
        {
          name: entityName,
          entityType: "component",
          observations: ["Initial"],
        },
      ])

      await helper.callToolJSON("add_observations", {
        observations: [
          {
            entityName,
            contents: ["Updated"],
          },
        ],
      })

      const result = await helper.callToolJSON("get_entity_history", {
        entityName,
      })

      result.history.forEach((version) => {
        ok(
          version.updatedAt >= version.createdAt,
          "updatedAt should be >= createdAt"
        )
      })
    })
  })

  // ==========================================================================
  // Test Group 2: get_relation_history
  // ==========================================================================

  describe("get_relation_history", () => {
    it("should track relation history through updates", async () => {
      const from = `rel_from_${Date.now()}`
      const to = `rel_to_${Date.now()}`

      await helper.createEntities([
        { name: from, entityType: "feature", observations: ["From entity"] },
        { name: to, entityType: "task", observations: ["To entity"] },
      ])

      // Create relation
      await helper.callToolJSON("create_relations", {
        relations: [
          {
            from,
            to,
            relationType: "depends_on",
            strength: 0.5,
            confidence: 0.8,
          },
        ],
      })

      // Update relation
      await helper.callToolJSON("update_relation", {
        relation: {
          from,
          to,
          relationType: "depends_on",
          strength: 0.9,
          confidence: 0.95,
        },
      })

      // Get history
      const result = await helper.callToolJSON("get_relation_history", {
        from,
        to,
        relationType: "depends_on",
      })

      ok(result.history, "should have history property")
      ok(Array.isArray(result.history), "history should be an array")
      ok(result.history.length >= 1, "should have at least 1 version")

      // Verify the updated values are present in the latest version
      const latestVersion = result.history[0]
      ok(latestVersion.from === from, "should have correct from")
      ok(latestVersion.to === to, "should have correct to")
      ok(
        latestVersion.relationType === "depends_on",
        "should have correct relationType"
      )
    })

    it("should handle non-existent relation", async () => {
      const timestamp = Date.now()
      await helper.expectToolError(
        "get_relation_history",
        {
          from: `nonexistent_from_${timestamp}`,
          to: `nonexistent_to_${timestamp}`,
          relationType: "depends_on",
        },
        "not found"
      )
    })

    it("should preserve relation type across versions", async () => {
      const from = `rel_type_from_${Date.now()}`
      const to = `rel_type_to_${Date.now()}`

      await helper.createEntities([
        { name: from, entityType: "decision", observations: ["From"] },
        { name: to, entityType: "feature", observations: ["To"] },
      ])

      await helper.callToolJSON("create_relations", {
        relations: [
          {
            from,
            to,
            relationType: "implements",
          },
        ],
      })

      await helper.callToolJSON("update_relation", {
        relation: {
          from,
          to,
          relationType: "implements",
          strength: 0.8,
        },
      })

      const result = await helper.callToolJSON("get_relation_history", {
        from,
        to,
        relationType: "implements",
      })

      result.history.forEach((version) => {
        strictEqual(version.relationType, "implements")
      })
    })

    it("should track strength changes in relation history", async () => {
      const from = `strength_from_${Date.now()}`
      const to = `strength_to_${Date.now()}`

      await helper.createEntities([
        { name: from, entityType: "task", observations: ["From"] },
        { name: to, entityType: "component", observations: ["To"] },
      ])

      // Create with initial strength
      await helper.callToolJSON("create_relations", {
        relations: [
          {
            from,
            to,
            relationType: "part_of",
            strength: 0.3,
          },
        ],
      })

      // Update strength
      await helper.callToolJSON("update_relation", {
        relation: {
          from,
          to,
          relationType: "part_of",
          strength: 0.7,
        },
      })

      const result = await helper.callToolJSON("get_relation_history", {
        from,
        to,
        relationType: "part_of",
      })

      ok(result.history.length >= 1)
      result.history.forEach((version) => {
        ok(
          typeof version.strength === "number" ||
            version.strength === undefined,
          "strength should be number or undefined"
        )
      })
    })

    it("should track confidence changes in relation history", async () => {
      const from = `confidence_from_${Date.now()}`
      const to = `confidence_to_${Date.now()}`

      await helper.createEntities([
        { name: from, entityType: "feature", observations: ["From"] },
        { name: to, entityType: "task", observations: ["To"] },
      ])

      await helper.callToolJSON("create_relations", {
        relations: [
          {
            from,
            to,
            relationType: "relates_to",
            confidence: 0.6,
          },
        ],
      })

      await helper.callToolJSON("update_relation", {
        relation: {
          from,
          to,
          relationType: "relates_to",
          confidence: 0.9,
        },
      })

      const result = await helper.callToolJSON("get_relation_history", {
        from,
        to,
        relationType: "relates_to",
      })

      ok(result.history.length >= 1)
      result.history.forEach((version) => {
        ok(
          typeof version.confidence === "number" ||
            version.confidence === undefined,
          "confidence should be number or undefined"
        )
      })
    })

    it("should include metadata in relation history", async () => {
      const from = `metadata_from_${Date.now()}`
      const to = `metadata_to_${Date.now()}`

      await helper.createEntities([
        { name: from, entityType: "component", observations: ["From"] },
        { name: to, entityType: "component", observations: ["To"] },
      ])

      await helper.callToolJSON("create_relations", {
        relations: [
          {
            from,
            to,
            relationType: "depends_on",
          },
        ],
      })

      const result = await helper.callToolJSON("get_relation_history", {
        from,
        to,
        relationType: "depends_on",
      })

      ok(result.history.length >= 1)
      result.history.forEach((version) => {
        ok(version.from, "should have from")
        ok(version.to, "should have to")
        ok(version.relationType, "should have relationType")
        // metadata is optional but if present should be an object
        if (version.metadata) {
          ok(typeof version.metadata === "object", "metadata should be object")
        }
      })
    })

    it("should return history for relation with single version", async () => {
      const from = `single_from_${Date.now()}`
      const to = `single_to_${Date.now()}`

      await helper.createEntities([
        { name: from, entityType: "task", observations: ["From"] },
        { name: to, entityType: "feature", observations: ["To"] },
      ])

      await helper.callToolJSON("create_relations", {
        relations: [
          {
            from,
            to,
            relationType: "part_of",
          },
        ],
      })

      const result = await helper.callToolJSON("get_relation_history", {
        from,
        to,
        relationType: "part_of",
      })

      ok(result.history.length >= 1, "should have at least 1 version")
      strictEqual(result.history[0].from, from)
      strictEqual(result.history[0].to, to)
      strictEqual(result.history[0].relationType, "part_of")
    })

    it("should handle relation with all optional fields", async () => {
      const from = `full_from_${Date.now()}`
      const to = `full_to_${Date.now()}`

      await helper.createEntities([
        { name: from, entityType: "decision", observations: ["From"] },
        { name: to, entityType: "component", observations: ["To"] },
      ])

      await helper.callToolJSON("create_relations", {
        relations: [
          {
            from,
            to,
            relationType: "implements",
            strength: 0.85,
            confidence: 0.92,
          },
        ],
      })

      const result = await helper.callToolJSON("get_relation_history", {
        from,
        to,
        relationType: "implements",
      })

      ok(result.history.length >= 1)
      const version = result.history[0]
      ok(typeof version.strength === "number", "should have strength")
      ok(typeof version.confidence === "number", "should have confidence")
    })
  })

  // ==========================================================================
  // Test Group 3: get_graph_at_time
  // ==========================================================================

  describe("get_graph_at_time", () => {
    it("should return graph state at specific timestamp", async () => {
      const timestamp1 = Date.now()

      // Create initial entity
      const entity1 = `time_entity_1_${timestamp1}`
      await helper.createEntities([
        { name: entity1, entityType: "feature", observations: ["First"] },
      ])

      // Wait and record timestamp
      await sleep(50)
      const timestamp2 = Date.now()

      // Add more entity
      const entity2 = `time_entity_2_${timestamp1}`
      await helper.createEntities([
        { name: entity2, entityType: "task", observations: ["Second"] },
      ])

      // Get graph at timestamp2 (should only have first entity)
      const result = await helper.callToolJSON("get_graph_at_time", {
        timestamp: timestamp2,
      })

      ok(result.entities, "should have entities property")
      ok(result.relations, "should have relations property")
      ok(Array.isArray(result.entities), "entities should be an array")
      ok(Array.isArray(result.relations), "relations should be an array")

      // Should contain first entity
      const entityNames = result.entities.map((e) => e.name)
      ok(entityNames.includes(entity1), "should include first entity")
    })

    it("should return empty graph for timestamp before any data", async () => {
      const veryOldTimestamp = Date.now() - 86_400_000 // 24 hours ago

      const result = await helper.callToolJSON("get_graph_at_time", {
        timestamp: veryOldTimestamp,
      })

      ok(Array.isArray(result.entities), "entities should be an array")
      ok(Array.isArray(result.relations), "relations should be an array")
      strictEqual(result.entities.length, 0, "should have no entities")
      strictEqual(result.relations.length, 0, "should have no relations")
    })

    it("should return current graph for future timestamp", async () => {
      const entityName = `future_test_${Date.now()}`
      await helper.createEntities([
        {
          name: entityName,
          entityType: "component",
          observations: ["Test"],
        },
      ])

      const futureTimestamp = Date.now() + 86_400_000 // 24 hours from now

      const result = await helper.callToolJSON("get_graph_at_time", {
        timestamp: futureTimestamp,
      })

      ok(Array.isArray(result.entities), "should have entities")
      ok(Array.isArray(result.relations), "should have relations")

      // Should include the entity we just created
      const entityNames = result.entities.map((e) => e.name)
      ok(entityNames.includes(entityName), "should include current entity")
    })

    it("should include relations valid at specified time", async () => {
      const timestamp = Date.now()
      const from = `rel_from_time_${timestamp}`
      const to = `rel_to_time_${timestamp}`

      await helper.createEntities([
        { name: from, entityType: "feature", observations: ["From"] },
        { name: to, entityType: "task", observations: ["To"] },
      ])

      await helper.callToolJSON("create_relations", {
        relations: [
          {
            from,
            to,
            relationType: "depends_on",
          },
        ],
      })

      const futureTimestamp = Date.now() + 1000

      const result = await helper.callToolJSON("get_graph_at_time", {
        timestamp: futureTimestamp,
      })

      ok(Array.isArray(result.relations), "should have relations array")
      // The relation should be in the graph
      const hasRelation = result.relations.some(
        (r) => r.from === from && r.to === to && r.relationType === "depends_on"
      )
      ok(hasRelation, "should include the created relation")
    })

    it("should handle timestamp as number type", async () => {
      const timestamp = Date.now()

      const result = await helper.callToolJSON("get_graph_at_time", {
        timestamp,
      })

      ok(result.entities, "should return entities")
      ok(result.relations, "should return relations")
    })

    it("should reject invalid timestamp type", async () => {
      await helper.expectToolError(
        "get_graph_at_time",
        { timestamp: "not-a-number" },
        "must be a number"
      )
    })

    it("should return proper structure with temporal metadata", async () => {
      const entityName = `temporal_meta_${Date.now()}`
      await helper.createEntities([
        {
          name: entityName,
          entityType: "decision",
          observations: ["Meta test"],
        },
      ])

      const result = await helper.callToolJSON("get_graph_at_time", {
        timestamp: Date.now() + 1000,
      })

      ok(result.entities, "should have entities")
      ok(Array.isArray(result.entities), "entities should be array")

      // Find our entity
      const entity = result.entities.find((e) => e.name === entityName)
      if (entity) {
        ok(entity.name, "entity should have name")
        ok(entity.entityType, "entity should have entityType")
        ok(
          Array.isArray(entity.observations),
          "entity should have observations"
        )
        ok(typeof entity.createdAt === "number", "should have createdAt")
        ok(typeof entity.updatedAt === "number", "should have updatedAt")
      }
    })
  })

  // ==========================================================================
  // Test Group 4: get_decayed_graph
  // ==========================================================================

  describe("get_decayed_graph", () => {
    it("should return graph with confidence decay applied", async () => {
      const from = `decay_from_${Date.now()}`
      const to = `decay_to_${Date.now()}`

      await helper.createEntities([
        { name: from, entityType: "feature", observations: ["From"] },
        { name: to, entityType: "task", observations: ["To"] },
      ])

      await helper.callToolJSON("create_relations", {
        relations: [
          {
            from,
            to,
            relationType: "depends_on",
            confidence: 1.0,
          },
        ],
      })

      const result = await helper.callToolJSON("get_decayed_graph", {})

      ok(result.entities, "should have entities property")
      ok(result.relations, "should have relations property")
      ok(Array.isArray(result.entities), "entities should be array")
      ok(Array.isArray(result.relations), "relations should be array")
    })

    it("should include all entities in decayed graph", async () => {
      const entityName = `decay_entity_${Date.now()}`
      await helper.createEntities([
        {
          name: entityName,
          entityType: "component",
          observations: ["Test"],
        },
      ])

      const result = await helper.callToolJSON("get_decayed_graph", {})

      ok(Array.isArray(result.entities), "should have entities")
      const entityNames = result.entities.map((e) => e.name)
      ok(entityNames.includes(entityName), "should include created entity")
    })

    it("should return proper graph structure", async () => {
      const result = await helper.callToolJSON("get_decayed_graph", {})

      ok(result, "should return result")
      ok(result.entities, "should have entities")
      ok(result.relations, "should have relations")
      ok(Array.isArray(result.entities), "entities should be array")
      ok(Array.isArray(result.relations), "relations should be array")
    })

    it("should handle empty graph", async () => {
      // Clean everything first
      await cleanupAllTestData()

      const result = await helper.callToolJSON("get_decayed_graph", {})

      ok(Array.isArray(result.entities), "should return entities array")
      ok(Array.isArray(result.relations), "should return relations array")
      strictEqual(result.entities.length, 0, "should have no entities")
      strictEqual(result.relations.length, 0, "should have no relations")
    })

    it("should preserve entity properties in decayed graph", async () => {
      const entityName = `preserve_test_${Date.now()}`
      await helper.createEntities([
        {
          name: entityName,
          entityType: "decision",
          observations: ["Preserve observation"],
        },
      ])

      const result = await helper.callToolJSON("get_decayed_graph", {})

      const entity = result.entities.find((e) => e.name === entityName)
      ok(entity, "should find created entity")
      strictEqual(entity.entityType, "decision")
      ok(Array.isArray(entity.observations))
      ok(entity.observations.includes("Preserve observation"))
    })

    it("should preserve relation properties in decayed graph", async () => {
      const from = `preserve_from_${Date.now()}`
      const to = `preserve_to_${Date.now()}`

      await helper.createEntities([
        { name: from, entityType: "task", observations: ["From"] },
        { name: to, entityType: "feature", observations: ["To"] },
      ])

      await helper.callToolJSON("create_relations", {
        relations: [
          {
            from,
            to,
            relationType: "part_of",
            strength: 0.8,
          },
        ],
      })

      const result = await helper.callToolJSON("get_decayed_graph", {})

      const relation = result.relations.find(
        (r) => r.from === from && r.to === to
      )
      ok(relation, "should find created relation")
      strictEqual(relation.relationType, "part_of")
      ok(typeof relation.strength === "number", "should have strength")
    })
  })
})
