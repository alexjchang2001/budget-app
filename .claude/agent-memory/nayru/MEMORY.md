# Reviewer Memory

> This file is automatically loaded into the Reviewer agent's system prompt (first 200 lines).
> Record recurring quality issues, architectural patterns, and review findings specific to this project.

## Quality Checks
- Files must stay under 400 lines (error) / 200 lines (warning)
- Functions under 50 lines, max 15 per file
- Coverage targets: new code should hit 80%+, critical paths 90%+
- Tests should verify behavior, not just execution

## Recurring Issues
<!-- Record patterns you see across multiple reviews -->
- [Schema null mismatches](project_schema_null_mismatches.md) — code inserts null for NOT NULL columns with defaults; PostgREST does not substitute default on explicit null
- [Silent .catch() masks signature drift](feedback_silent_catch_masks_signature_drift.md) — routes wrap lib calls in `.catch(() => null)`; when call site passes wrong arg shape, runtime TypeError is swallowed and route returns 200

## Security Review Points
<!-- Record project-specific security concerns -->
