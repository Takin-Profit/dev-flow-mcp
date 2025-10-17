/**
 * Test Fixtures for Relation Data
 * Provides reusable test data for e2e tests
 */

export const validRelationTypes = [
  "depends_on",
  "implements",
  "part_of",
  "relates_to",
]

// RelationType: depends_on | implements | part_of | relates_to

export const validRelations = {
  dependsOn: {
    from: "auth-service",
    to: "database-service",
    relationType: "depends_on",
  },
  implements: {
    from: "login-feature",
    to: "oauth-spec",
    relationType: "implements",
  },
  partOf: {
    from: "login-component",
    to: "auth-feature",
    relationType: "part_of",
  },
  relatesTo: {
    from: "user-profile",
    to: "authentication",
    relationType: "relates_to",
  },
}

export const relationsWithMetadata = {
  withStrength: {
    from: "service-a",
    to: "service-b",
    relationType: "depends_on",
    strength: 0.8,
  },
  withConfidence: {
    from: "service-a",
    to: "service-b",
    relationType: "depends_on",
    confidence: 0.9,
  },
  withBoth: {
    from: "service-a",
    to: "service-b",
    relationType: "depends_on",
    strength: 0.7,
    confidence: 0.85,
  },
  withMetadata: {
    from: "service-a",
    to: "service-b",
    relationType: "depends_on",
    metadata: {
      source: "architecture-diagram",
      timestamp: Date.now(),
      tags: ["critical", "production"],
    },
  },
  complete: {
    from: "service-a",
    to: "service-b",
    relationType: "depends_on",
    strength: 0.75,
    confidence: 0.9,
    metadata: {
      source: "code-analysis",
      version: "1.0.0",
      reviewer: "architect",
    },
  },
}

export const invalidRelations = {
  missingFrom: {
    to: "entity-b",
    relationType: "depends_on",
  },
  missingTo: {
    from: "entity-a",
    relationType: "depends_on",
  },
  invalidType: {
    from: "entity-a",
    to: "entity-b",
    relationType: "invalid_relation_type",
  },
  strengthOutOfRange: {
    from: "entity-a",
    to: "entity-b",
    relationType: "depends_on",
    strength: 1.5, // > 1.0
  },
  confidenceNegative: {
    from: "entity-a",
    to: "entity-b",
    relationType: "depends_on",
    confidence: -0.5, // < 0.0
  },
}

export const edgeCaseRelations = {
  selfReference: {
    from: "entity-a",
    to: "entity-a",
    relationType: "relates_to",
  },
  minStrength: {
    from: "entity-a",
    to: "entity-b",
    relationType: "depends_on",
    strength: 0.0,
  },
  maxStrength: {
    from: "entity-a",
    to: "entity-b",
    relationType: "depends_on",
    strength: 1.0,
  },
  largeMetadata: {
    from: "entity-a",
    to: "entity-b",
    relationType: "depends_on",
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
}

/**
 * Create test relation between two entity names
 */
export function createTestRelation(
  fromName,
  toName,
  type = "relates_to",
  options
) {
  return {
    from: fromName,
    to: toName,
    relationType: type,
    ...options,
  }
}

/**
 * Create multiple test relations
 */
export function createTestRelations(entities, type = "relates_to") {
  const relations = []

  for (let i = 0; i < entities.length - 1; i++) {
    const current = entities[i]
    const next = entities[i + 1]
    if (current && next) {
      relations.push(createTestRelation(current.name, next.name, type))
    }
  }

  return relations
}

/**
 * Create circular dependency graph
 */
export function createCircularRelations(entityNames) {
  const relations = []

  for (let i = 0; i < entityNames.length; i++) {
    const from = entityNames[i]
    const to = entityNames[(i + 1) % entityNames.length]
    if (from && to) {
      relations.push(createTestRelation(from, to, "depends_on"))
    }
  }

  return relations
}
