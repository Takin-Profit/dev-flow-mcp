# Next Session Prompt

Copy and paste this prompt to start the next session:

---

Please complete the branded types removal refactoring that was started in the previous session.

**Read these files in order:**

1. `docs/types/CURRENT_STATUS.md` - Start here for the complete implementation plan
2. `docs/types/SESSION_SUMMARY_2025_10_18.md` - Background on the design decision

Then execute the 5-step plan documented in CURRENT_STATUS.md:

**Step 1:** Remove `.brand<>()` from 14 schemas in `src/types/validation.ts`
**Step 2:** Remove unused branded type imports from `src/db/sqlite-db.ts`
**Step 3:** Create `src/utils/sqlite-error-handler.ts` with sqlite-x error handling
**Step 4:** Update database methods in `src/db/sqlite-db.ts` to use error handler
**Step 5:** Run `pnpm exec tsc --noEmit` (expect 0 errors) and `pnpm test`

All line numbers, code examples, and rationale are provided in CURRENT_STATUS.md.

---

**Alternative shorter version:**

Read `docs/types/CURRENT_STATUS.md` and execute the 5-step plan to remove branded types and add sqlite-x error handling.
