# Task: Implement Code Review Fixes

Your task is to fix the codebase by implementing the changes detailed in the code review.

## Instructions

### 1. Read the Review Guide (Required)

First, read the file `docs/types/REVIEW.md`. This document contains the complete list of problems and the detailed solutions you need to implement.

### 2. Implement the Fixes

Follow the instructions in `REVIEW.md` to modify the following files in order:

1.  **`src/types/embedding.ts`**: This file requires a full migration from `arktype` to `zod`. Convert all schemas and validators.
2.  **`src/utils/fetch.ts`**: Refactor the `fetchData` function to use Zod for validation instead of ArkType.
3.  **`src/embeddings/openai-embedding-service.ts`**: Update this service to use the new Zod-based schemas and validation logic.
4.  **`src/types/responses.ts`**: Remove the unused `ErrorResponseSchema` as detailed in the review.

### 3. Verify Your Work

After implementing the changes, you must verify that the fixes are working correctly and have not introduced any regressions.

1.  Run `mise run build` and ensure it completes successfully.
2.  Confirm that all `arktype`-related warnings are gone from the build output.
3.  Run the project's test suite to ensure all tests still pass.
