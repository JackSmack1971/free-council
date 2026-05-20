# MoA Aggregation Quality Eval Suite

Held-out aggregation quality evaluation for `agg_prompt.v1.txt`.

## Purpose

This eval suite validates Phase 5 MoA aggregation quality before deployment. **Phase 5 cannot be deployed until the eval passes with ≥90% synthesis quality (≥13/15 cases).**

## Test Case Composition

| Subset | Count | Description |
|--------|-------|-------------|
| `n3_proposers` | 5 | Standard free-tier hybrid config (3 proposers) |
| `n4_proposers` | 5 | Extended proposer count for Deep mode (4 proposers) |
| `conflicting_facts` | 5 | Proposers produce contradictory factual claims |

**Total: 15 test cases**

## Running the Eval

```bash
npx ts-node scripts/eval-moa-aggregation.ts
```

Results are written to `tests/eval/moa-aggregation/results-{timestamp}.json`.

## Rerun Requirement

Any change to `agg_prompt.v1.txt` or `proposersPerLayer` default requires re-running **all three subsets** before Phase 5 deployment.

## Adding Test Cases

Add entries to `test-cases.json` with the following structure:

```json
{
  "id": "unique-id",
  "subset": "n3_proposers | n4_proposers | conflicting_facts",
  "description": "What this test validates",
  "userQuery": "The original user query",
  "proposers": [
    { "role": "RoleName", "modelId": "model/id:free", "response": "Response text" }
  ],
  "expectedSynthesisQuality": "pass | fail",
  "rubric": "Human-readable criteria for the judge model to evaluate against"
}
```

## Evaluation Criteria

Judge model: `openrouter/owl-alpha`

Each test case is scored as `pass` or `fail` by the judge model, which receives:
- The original user query
- All proposer responses
- The synthesized output from the aggregator
- The human-authored rubric

Pass threshold: ≥90% (≥13/15 cases pass).
