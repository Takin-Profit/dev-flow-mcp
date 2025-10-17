/**
 * Test Fixtures for Entity Data
 * Provides reusable test data for e2e tests
 */

export const validEntities = {
  feature: {
    name: "user-authentication",
    entityType: "feature",
    observations: ["Implements OAuth2", "Supports social login"],
  },
  task: {
    name: "implement-login-form",
    entityType: "task",
    observations: ["Create React component", "Add form validation"],
  },
  decision: {
    name: "use-postgresql",
    entityType: "decision",
    observations: [
      "Chose PostgreSQL over MongoDB",
      "Better for relational data",
    ],
  },
  component: {
    name: "auth-service",
    entityType: "component",
    observations: ["Handles authentication", "JWT token generation"],
  },
}

export const invalidEntities = {
  missingObservations: {
    name: "invalid-entity",
    entityType: "feature",
    // observations missing
  },
  invalidType: {
    name: "invalid-type",
    entityType: "invalid_type",
    observations: ["Test"],
  },
  emptyName: {
    name: "",
    entityType: "feature",
    observations: ["Test"],
  },
  emptyObservations: {
    name: "empty-obs",
    entityType: "feature",
    observations: [],
  },
  nullFields: {
    name: null,
    entityType: "feature",
    observations: ["Test"],
  },
}

export const edgeCaseEntities = {
  longName: {
    name: "a".repeat(500),
    entityType: "feature",
    observations: ["Very long name"],
  },
  specialChars: {
    name: "entity-with-special-chars!@#$%",
    entityType: "feature",
    observations: ["Test special characters"],
  },
  unicode: {
    name: "entity-日本語-emoji-🚀",
    entityType: "feature",
    observations: ["Unicode test", "表示テスト"],
  },
  manyObservations: {
    name: "many-observations",
    entityType: "feature",
    observations: Array.from({ length: 100 }, (_, i) => `Observation ${i + 1}`),
  },
  longObservation: {
    name: "long-observation",
    entityType: "feature",
    observations: ["A".repeat(10_000)],
  },
}

/**
 * Generate unique entity name with timestamp
 */
export function generateEntityName(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`
}

/**
 * Create test entity with unique name
 */
export function createTestEntity(type = "feature", customObservations) {
  return {
    name: generateEntityName(`test_${type}`),
    entityType: type,
    observations: customObservations || [`Test ${type} entity`],
  }
}

/**
 * Create batch of test entities
 */
export function createTestEntities(count, type = "feature") {
  return Array.from({ length: count }, (_, i) => ({
    name: generateEntityName(`batch_${type}_${i}`),
    entityType: type,
    observations: [`Batch entity ${i + 1}`],
  }))
}
