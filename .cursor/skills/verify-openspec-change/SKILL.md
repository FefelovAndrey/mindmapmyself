---
name: verify-openspec-change
description: Verify an OpenSpec change against its scenarios and tests. Use when the user wants to check a change before archive, says «проверь», «проверь по сценариям», «verify», or after /opsx-apply when they are ready to test.
---

# Verify OpenSpec change

The owner does not review code. Your job is to check artifacts vs implementation, run tests, and give them a short UI checklist.

## Steps

1. Select the change. If unnamed, infer from context, or run `openspec list --json` and ask. Announce `Using change: <name>`.
2. Read status and artifacts:
   - `openspec status --change "<name>" --json`
   - `openspec instructions apply --change "<name>" --json`
   - Load proposal, specs, design, tasks from `contextFiles`.
3. Completeness: checkbox tasks (`[x]` done; `[ ]` and other markers incomplete). Map each `### Requirement:` to code by search. Incomplete tasks or missing requirements are CRITICAL.
4. Correctness: each spec scenario should have a visible UI path or an automated test. Missing coverage is WARNING unless the requirement is unimplemented (then CRITICAL).
5. Run `npm test`. Failures are CRITICAL.
6. Coherence: note only glaring mismatches with `design.md` (WARNING). Do not dump code.

## Report to the owner

Keep it short. No diffs.

```
Change: <name>
Completeness: …  Correctness: …  Tests: …

CRITICAL
- …

WARNING
- …

Чеклист для вас (браузер):
1. …
2. …
```

Each checklist item is one spec scenario in Russian: what to do, what they should see.

Do not archive. Wait for their test result.
