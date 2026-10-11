import test from 'node:test';
import assert from 'node:assert/strict';
import { createReportPdf, createTextPdf } from '../public/pdf-report.js';

test('creates a valid PDF document instead of a renamed text file', () => {
  const bytes = createTextPdf('Requirement: Improve luggage access.\nDecision: Approved.', { title: 'PM REPORT' });
  const pdf = new TextDecoder().decode(bytes);
  assert.match(pdf, /^%PDF-1\.4/);
  assert.match(pdf, /\/Type \/Catalog/);
  assert.match(pdf, /\/Type \/Page/);
  assert.match(pdf, /xref\n/);
  assert.match(pdf, /%%EOF$/);
});

test('paginates long reports', () => {
  const bytes = createTextPdf(Array.from({ length: 120 }, (_, index) => `Decision ${index + 1}: evidence-backed requirement`).join('\n'));
  const pdf = new TextDecoder().decode(bytes);
  assert.match(pdf, /\/Count 3\b/);
  assert.equal((pdf.match(/\/Type \/Page\b/g) || []).length, 3);
});

test('creates a branded, sectioned product report', () => {
  const bytes = createReportPdf({
    title: 'PM REQUIREMENT REPORT',
    subtitle: 'Evidence-led product-cycle priorities',
    metadata: [{ label: 'Vehicle', value: 'G60' }, { label: 'Market', value: 'United States' }],
    sections: [{ title: 'Exterior & utility', items: [{ kicker: '#1 · Approved', title: 'Improve luggage access.', details: ['Evidence: 42 cited records.', 'Owner: Body Engineering'] }] }]
  });
  const pdf = new TextDecoder().decode(bytes);
  assert.match(pdf, /BMW PRODUCT INTELLIGENCE/);
  assert.match(pdf, /PM REQUIREMENT REPORT/);
  assert.match(pdf, /EXTERIOR & UTILITY/);
  assert.match(pdf, /0\.055 0\.102 0\.157 rg/);
  assert.match(pdf, /Page 1 of 1/);
});
