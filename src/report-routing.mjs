const includesAny = (value, terms) => terms.some(term => value.includes(term));

export function fallbackReportAudience(requirement) {
  const text = [requirement.group, requirement.feature, requirement.outcome, requirement.statement, requirement.owner?.name, requirement.responsible_entity]
    .filter(Boolean).join(' ').toLowerCase();
  const technicalTerms = ['handling', 'road', 'powertrain', 'charging', 'battery', 'thermal', 'software', 'controls', 'latency', 'safety', 'performance', 'efficien', 'range', 'reliab', 'isolate', 'acceleration', 'braking', 'visibility'];
  const gtmTerms = ['brand', 'appearance', 'expression', 'distinctive', 'recognizable', 'premium', 'personal', 'ambience', 'comfort', 'spacious', 'cargo', 'luggage', 'convenien', 'intuitive', 'customer', 'experience'];
  const score = terms => terms.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0);
  let technicalScore = score(technicalTerms);
  let gtmScore = score(gtmTerms);
  if (includesAny(text, ['driving & powertrain', 'digital experience & controls'])) technicalScore += 2;
  if (includesAny(text, ['exterior & utility', 'interior & comfort'])) gtmScore += 1;
  if (includesAny(text, ['product marketing', 'sales', 'launch', 'pricing', 'portfolio', 'retail', 'communications'])) gtmScore += 4;
  if (includesAny(text, ['engineering', 'technical', 'manufactur', 'product integration'])) technicalScore += 1;
  const audience = gtmScore > technicalScore ? 'gtm' : 'technical';
  return { technical:audience === 'technical', gtm:audience === 'gtm', rationale:`Deterministic fallback selected ${audience === 'technical' ? 'Technical' : 'GTM'} as the primary audience from the requirement's dominant outcome and vehicle domain.` };
}

export function mergeReportAudienceAssignments(requirements, assignments = []) {
  const accepted = new Map();
  for (const assignment of assignments) {
    const id = String(assignment?.requirementId || assignment?.requirement_id || '');
    const audience = assignment?.audience || (assignment?.technical && !assignment?.gtm ? 'technical' : assignment?.gtm && !assignment?.technical ? 'gtm' : '');
    if (!id || !['technical','gtm'].includes(audience)) continue;
    accepted.set(id, { technical:audience === 'technical', gtm:audience === 'gtm', rationale:String(assignment.rationale || '').trim() || 'Primary audience assigned from the requirement context.' });
  }
  return new Map(requirements.map(requirement => [requirement.id, accepted.get(requirement.id) || fallbackReportAudience(requirement)]));
}

export function partitionReportRequirements(requirements, routing) {
  const technical = requirements.filter(requirement => routing.get(requirement.id)?.technical);
  const gtm = requirements.filter(requirement => routing.get(requirement.id)?.gtm);
  return { technical, gtm };
}
