/**
 * Types for DevFlow MCP Prompts
 *
 * Prompts help AI agents understand how to use the knowledge graph
 * in a cascading workflow (planner → task creator → coder → reviewer)
 */

import type { z } from "zod"

/**
 * Prompt message role
 */
export type PromptRole = "user" | "assistant"

/**
 * Prompt message content
 */
export type PromptMessage = {
  role: PromptRole
  content: {
    type: "text"
    text: string
  }
}

/**
 * Prompt result - what gets returned to the AI
 */
export type PromptResult = {
  messages: PromptMessage[]
}

/**
 * Prompt registration info
 */
export type PromptInfo = {
  name: string
  description: string
  argsSchema?: z.ZodSchema
}

/**
 * Prompt handler function type
 */
export type PromptHandler<T = Record<string, unknown>> = (
  args: T
) => PromptResult
