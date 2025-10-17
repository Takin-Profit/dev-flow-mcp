/**
 * Zod Schemas for Prompt Arguments
 *
 * These define the arguments that each prompt accepts,
 * with completable fields for better UX in AI clients.
 *
 * Note: We use Zod here (not ArkType) because MCP SDK's Completable
 * feature is tightly coupled with Zod's type system.
 */

import { completable } from "@modelcontextprotocol/sdk/server/completable.js"
import { z } from "#config"

/**
 * Entity types supported by DevFlow MCP
 */
export const ENTITY_TYPES = [
  "feature",
  "task",
  "decision",
  "component",
  "test",
] as const

/**
 * Relation types supported by DevFlow MCP
 */
export const RELATION_TYPES = [
  "implements",
  "depends_on",
  "relates_to",
  "part_of",
] as const

/**
 * Schema for init-project prompt
 * Helps agents start a new project or feature
 */
export const InitProjectArgsSchema = z.object({
  projectName: z.string().describe("The name of the project or feature"),
  description: z
    .string()
    .describe("High-level description of what this project will do"),
  goals: z
    .string()
    .optional()
    .describe("Specific goals or requirements for this project"),
})

/**
 * Schema for get-context prompt
 * Helps agents retrieve relevant information before working
 */
export const GetContextArgsSchema = z.object({
  query: z
    .string()
    .describe("What are you working on? (used for semantic search)"),
  entityTypes: z
    .array(
      completable(z.enum(ENTITY_TYPES), (value) => {
        // Provide entity type suggestions based on partial input
        return ENTITY_TYPES.filter((type) => type.startsWith(value))
      })
    )
    .optional()
    .describe(
      "Filter by specific entity types (feature, task, decision, component, test)"
    ),
  includeHistory: z
    .boolean()
    .optional()
    .default(false)
    .describe("Include version history of entities"),
})

/**
 * Schema for remember-work prompt
 * Helps agents store their work in the knowledge graph
 */
export const RememberWorkArgsSchema = z.object({
  workType: completable(z.enum(ENTITY_TYPES), (value) => {
    // Provide entity type suggestions
    return ENTITY_TYPES.filter((type) => type.startsWith(value))
  }).describe("What type of work did you complete?"),
  name: z
    .string()
    .describe("Name/title of the work (e.g., 'UserAuth', 'LoginEndpoint')"),
  description: z.string().describe("What did you do? (stored as observations)"),
  implementsTask: z
    .string()
    .optional()
    .describe(
      "Name of the task this work implements (creates 'implements' relation)"
    ),
  partOfFeature: z
    .string()
    .optional()
    .describe(
      "Name of the feature this is part of (creates 'part_of' relation)"
    ),
  dependsOn: z
    .array(z.string())
    .optional()
    .describe(
      "Names of other components this depends on (creates 'depends_on' relations)"
    ),
  keyDecisions: z
    .string()
    .optional()
    .describe("Any important decisions made during this work"),
})

/**
 * Schema for review-context prompt
 * Helps reviewers get full context before reviewing
 */
export const ReviewContextArgsSchema = z.object({
  entityName: z
    .string()
    .describe("Name of the entity to review (component, task, etc.)"),
  includeRelated: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include related entities (dependencies, implementations, etc.)"),
  includeDecisions: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include decision history related to this entity"),
})

export type InitProjectArgs = z.infer<typeof InitProjectArgsSchema>
export type GetContextArgs = z.infer<typeof GetContextArgsSchema>
export type RememberWorkArgs = z.infer<typeof RememberWorkArgsSchema>
export type ReviewContextArgs = z.infer<typeof ReviewContextArgsSchema>
