import type { KnowledgeGraphManager } from "#knowledge-graph-manager.ts"
import type { Logger } from "#types"

/**
 * Handles the add_observations tool request
 * @param args The arguments for the tool request
 * @param knowledgeGraphManager The KnowledgeGraphManager instance
 * @param logger Logger instance for structured logging
 * @returns A response object with the result content
 */

export async function handleAddObservations(
  args: Record<string, unknown>,
  knowledgeGraphManager: KnowledgeGraphManager,
  logger: Logger
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    // Enhanced logging for debugging
    logger.debug("addObservations handler called", {
      timestamp: new Date().toISOString(),
      args,
      argsKeys: Object.keys(args),
      argsTypes: Object.keys(args).reduce(
        (acc, k) => {
          acc[k] = typeof args[k]
          return acc
        },
        {} as Record<string, string>
      ),
    })

    // Validate the observations array
    if (!(args.observations && Array.isArray(args.observations))) {
      throw new Error("Invalid observations: must be an array")
    }

    // Add default values for required parameters
    const defaultStrength = 0.9
    const defaultConfidence = 0.95

    // Force add strength to args if it doesn't exist
    if (args.strength === undefined) {
      logger.debug("Adding default strength value", {
        defaultStrength,
      })
      args.strength = defaultStrength
    }

    // Ensure each observation has the required fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processedObservations = args.observations.map((obs: any) => {
      // Validate required fields
      if (!obs.entityName) {
        throw new Error("Missing required parameter: entityName")
      }
      if (!(obs.contents && Array.isArray(obs.contents))) {
        throw new Error(
          "Missing required parameter: contents (must be an array)"
        )
      }

      // Always set strength value
      const obsStrength =
        obs.strength !== undefined ? obs.strength : args.strength

      logger.debug("Processing observation", {
        entityName: obs.entityName,
        strength: obsStrength,
      })

      // Set defaults for each observation
      return {
        entityName: obs.entityName,
        contents: obs.contents,
        strength: obsStrength,
        confidence:
          obs.confidence !== undefined
            ? obs.confidence
            : args.confidence || defaultConfidence,
        metadata: obs.metadata || args.metadata || { source: "API call" },
      }
    })

    // Call knowledgeGraphManager
    logger.debug("Calling knowledgeGraphManager.addObservations", {
      observationsCount: processedObservations.length,
      processedObservations,
    })

    const result = await knowledgeGraphManager.addObservations(
      processedObservations
    )

    logger.debug("addObservations result", {
      result,
    })

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              result,
              debug: {
                timestamp: Date.now(),
                input_args: args,
                processed_observations: processedObservations,
                tool_version: "v2 with debug info",
              },
            },
            null,
            2
          ),
        },
      ],
    }
  } catch (error) {
    const err = error as Error
    // Enhanced error logging for debugging
    logger.error("addObservations error", {
      error: err.message,
      stack: err.stack || "No stack trace available",
    })

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: err.message,
              debug: {
                timestamp: Date.now(),
                input_args: args || "No args available",
                error_type: err.constructor.name,
                error_stack: err.stack?.split("\n") || "No stack trace",
                tool_version: "v2 with debug info",
              },
            },
            null,
            2
          ),
        },
      ],
    }
  }
}
