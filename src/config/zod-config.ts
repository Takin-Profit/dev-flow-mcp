/**
 * Global Zod Configuration
 *
 * Configures Zod to use zod-validation-error's error map for user-friendly messages.
 * Import this configured version of Zod throughout the codebase.
 *
 * @example
 * ```typescript
 * // Use this instead of importing from 'zod' directly
 * import { z } from "#config/zod-config.js"
 * ```
 */

import { z } from "zod"
import { createErrorMap } from "zod-validation-error"

/**
 * Configure Zod with user-friendly error messages
 *
 * See: https://github.com/causaly/zod-validation-error#createerrormap
 */
z.setErrorMap(
  createErrorMap({
    // Show detailed format information in error messages
    displayInvalidFormatDetails: false, // Set to true in dev mode if needed

    // Display configuration for allowed values
    maxAllowedValuesToDisplay: 10,
    allowedValuesSeparator: ", ",
    allowedValuesLastSeparator: " or ",
    wrapAllowedValuesInQuote: true,

    // Display configuration for unrecognized keys
    maxUnrecognizedKeysToDisplay: 5,
    unrecognizedKeysSeparator: ", ",
    unrecognizedKeysLastSeparator: " and ",
    wrapUnrecognizedKeysInQuote: true,

    // Localization for dates and numbers
    dateLocalization: true,
    numberLocalization: true,
  })
)

/**
 * Export configured Zod instance
 *
 * Import this throughout the codebase instead of importing 'zod' directly
 */
export { z }
