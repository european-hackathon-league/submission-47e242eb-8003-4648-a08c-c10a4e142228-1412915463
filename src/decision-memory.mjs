export const DECISION_EVENT_TYPES = new Set([
  'requirement-approved',
  'requirement-approved-with-conditions',
  'requirement-rejected'
]);

export const decisionReason = event => String(event?.data?.rationale || event?.data?.pmReasoning || '').trim();

export const isRecordedDecision = event => DECISION_EVENT_TYPES.has(event?.type) && Boolean(decisionReason(event));
