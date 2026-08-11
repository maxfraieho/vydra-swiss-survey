# Phase P4: Zero-Hallucination Vision CoT Prompting & Ground Truth Benchmark Spec

## Acceptance Criteria

### Zero-Hallucination CoT Prompting
- **Given** a screenshot and survey question context supplied to `vision.py`
- **When** generating vision model prompt instructions
- **Then** system prompt in `vision.py` forces structured JSON output (`visual_analysis` -> `persona_matching` -> `decision`)
- **And** prompt explicitly forbids inventing pixel coordinates

### Ground Truth Benchmark Matching
- **Given** 10 benchmark test cases with ground truth actions
- **When** evaluating vision decision outputs against benchmark cases
- **Then** vision decision outputs MUST match expected ground truth actions across all 10 benchmark test cases

## Risk / Rollback Plan

| Risk | Mitigation | Rollback Plan |
| --- | --- | --- |
| LLM returns invalid JSON or violates standard CoT structure | Strict JSON schema validation and retry with fallback prompt | Revert system prompt changes in `vision.py` to legacy non-CoT mode |
| Hallucinated coordinate references lead to incorrect click targets | Enforce strict rule forbidding pixel coordinate generation in system prompt | Fallback vision decision targeting to CDP element locator lookup |
| Benchmark test cases fail due to LLM decision non-determinism | Temperature zero parameter tuning and explicit CoT reasoning steps | Revert prompt schema updates and lower decision threshold criteria |
