import test from 'node:test';
import assert from 'node:assert/strict';
import { decisionReason, isRecordedDecision } from '../src/decision-memory.mjs';

test('decision memory accepts only approvals and rejections that contain a reason', () => {
  const approved={type:'requirement-approved',data:{rationale:'Meets the product objective.'}};
  const rejected={type:'requirement-rejected',data:{rationale:'Conflicts with the confirmed package constraint.'}};
  const noReason={type:'requirement-approved',data:{}};
  const recalculation={type:'group-recalibrated',data:{rationale:'Ranking changed.'}};
  assert.equal(isRecordedDecision(approved),true);
  assert.equal(isRecordedDecision(rejected),true);
  assert.equal(isRecordedDecision(noReason),false);
  assert.equal(isRecordedDecision(recalculation),false);
  assert.equal(decisionReason(rejected),'Conflicts with the confirmed package constraint.');
});

test('historical approval reasoning can be rendered as a decision reason', () => {
  assert.equal(decisionReason({data:{pmReasoning:'Prior-cycle rationale.'}}),'Prior-cycle rationale.');
});
