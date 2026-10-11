// PM-supplied evidence: types, CSV parsing, feature matching, validation and conversion
// into the same structures the ranking engine already reads. Shared by browser and server.

export const UPLOAD_TYPES = {
  customer_feedback: {
    label: 'Customer feedback',
    help: 'Reviews, survey comments, dealer notes. Counts toward customer demand.',
    columns: ['text', 'feature', 'feedback_type'],
    required: ['text'],
    example: ['The rear seats feel cramped on long trips.', 'Seats', 'Difficult to Use']
  },
  market_data: {
    label: 'Market data',
    help: 'Studies, sales notes, competitor benchmarks. Adds to market evidence.',
    columns: ['text', 'feature', 'source'],
    required: ['text'],
    example: ['Mercedes E-Class 2027 makes ventilated seats standard in the US.', 'Seats', 'Competitor price list 2027']
  },
  global_trend: {
    label: 'Global trend',
    help: 'Technology and consumer trends expected by launch. Adds to market evidence.',
    columns: ['text', 'feature', 'source_url'],
    required: ['text'],
    example: ['Wireless phone charging with active cooling is becoming expected in premium sedans.', 'Mobile device, wireless charging', 'https://example.com/report']
  },
  past_decision: {
    label: 'Past decision',
    help: 'Decisions and reasons from earlier product cycles. Added to Decision Memory.',
    columns: ['requirement', 'decision', 'reasoning', 'feature', 'product_cycle'],
    required: ['requirement', 'decision', 'reasoning'],
    example: ['Offer ventilated front seats', 'approved', 'Strong US demand in hot climates; supplier ready.', 'Seats', 'G60 cycle 2021']
  }
};

export const MAX_UPLOAD_ROWS = 500;
const MAX_TEXT = 2000;
const DECISIONS = ['approved', 'approved with conditions', 'rejected'];
const COLUMN_ALIASES = { comment: 'text', feedback: 'text', note: 'text', trend: 'text', insight: 'text', category: 'feature', topic: 'feature', type: 'feedback_type', url: 'source_url', link: 'source_url', status: 'decision', reason: 'reasoning', rationale: 'reasoning', cycle: 'product_cycle' };

// RFC 4180 style: quoted fields, escaped quotes, commas, semicolons and newlines inside quotes.
export function parseCsv(input) {
  const text = String(input).replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && !field) quoted = true; // quotes only open at the start of a field
    else if (c === delimiter) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(cells => cells.some(cell => cell.trim()));
}

const normalizeHeader = header => {
  const key = String(header).trim().toLowerCase().replace(/[\s-]+/g, '_');
  return COLUMN_ALIASES[key] || key;
};

// Returns { rows, errors }. CSV needs a header row; pasted plain text is one item per line.
export function parseInput(type, input, { csv = false } = {}) {
  const spec = UPLOAD_TYPES[type];
  if (!spec) return { rows: [], errors: ['Choose what kind of evidence this is.'] };
  const errors = [];
  let rows;
  if (csv) {
    const table = parseCsv(input);
    if (table.length < 2) return { rows: [], errors: ['The CSV needs a header row and at least one data row.'] };
    const headers = table[0].map(normalizeHeader);
    const missing = spec.required.filter(column => !headers.includes(column));
    if (missing.length) return { rows: [], errors: [`Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Download the template for the expected layout.`] };
    rows = table.slice(1).map((cells, index) => ({ row: index + 2, ...Object.fromEntries(headers.map((header, i) => [header, String(cells[i] ?? '').trim()])) }));
  } else {
    if (type === 'past_decision') return { rows: [], errors: ['Past decisions need several fields. Upload a CSV using the template.'] };
    rows = String(input).split(/\r?\n/).map(line => line.trim()).filter(Boolean).map((text, index) => ({ row: index + 1, text }));
  }
  rows = rows.filter(row => spec.required.every(column => row[column]));
  if (!rows.length) errors.push('No usable rows found. Every row needs: ' + spec.required.join(', ') + '.');
  if (rows.length > MAX_UPLOAD_ROWS) { errors.push(`Only the first ${MAX_UPLOAD_ROWS} rows are used.`); rows = rows.slice(0, MAX_UPLOAD_ROWS); }
  if (type === 'past_decision') rows.forEach(row => { row.decision = normalizeDecision(row.decision); });
  return { rows, errors };
}

const normalizeDecision = value => {
  const v = String(value).trim().toLowerCase();
  if (/condition/.test(v)) return 'approved with conditions';
  if (/^(approved?|yes|accept|go)/.test(v)) return 'approved';
  if (/^(reject|no|declin|drop)/.test(v)) return 'rejected';
  return v;
};

export function templateCsv(type) {
  const spec = UPLOAD_TYPES[type];
  const quote = value => /[",\n;]/.test(value) ? `"${String(value).replace(/"/g, '""')}"` : value;
  return `${spec.columns.join(',')}\n${spec.example.map(quote).join(',')}\n`;
}

const STOP = new Set(['and', 'the', 'with', 'from', 'for', 'overall', 'technology', 'function', 'vehicle', 'front', 'rear', 'open', 'close', 'operation', 'setting', 'experience', 'customer', 'this', 'that', 'feels', 'would', 'car', 'cars', 'bmw', 'drive', 'driving', 'wish', 'like', 'love', 'want', 'need', 'more', 'much', 'very', 'really']);
const tokens = value => String(value).toLowerCase().replace(/\s+/g, ' ').split(/[^a-z0-9äöüß]+/).filter(token => token.length > 2 && !STOP.has(token));
const stem = token => token.replace(/(ings|ing|ers|er|es|s)$/, '');

// Best existing feature for a row, or '' when nothing matches. An explicit feature column wins when it exists.
export function suggestFeature(row, features) {
  const named = String(row.feature || '').trim().toLowerCase();
  if (named) {
    const exact = features.find(feature => feature.toLowerCase().replace(/\s+/g, ' ') === named.replace(/\s+/g, ' '));
    if (exact) return exact;
  }
  const words = new Set(tokens(`${row.feature || ''} ${row.text || ''} ${row.requirement || ''}`).map(stem));
  let best = '', bestScore = 0;
  for (const feature of features) {
    const featureWords = tokens(feature).map(stem);
    if (!featureWords.length) continue;
    const hits = featureWords.filter(word => words.has(word)).length;
    const score = hits / featureWords.length + hits * 0.01;
    if (hits && score > bestScore) { best = feature; bestScore = score; }
  }
  return best;
}

const clean = (value, max = MAX_TEXT) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// Server-side validation of a batch before it is stored.
export function validateBatch(input) {
  const type = String(input?.type || '');
  const spec = UPLOAD_TYPES[type];
  if (!spec) throw new Error('Unknown evidence type.');
  const weight = Number(input.weight);
  if (!Number.isInteger(weight) || weight < 1 || weight > 10) throw new Error('Weight must be a whole number from 1 to 10.');
  const vehicle = clean(input.vehicle, 20), market = clean(input.market, 10);
  if (!vehicle || !market) throw new Error('Vehicle and market are required.');
  const rows = (Array.isArray(input.rows) ? input.rows : []).slice(0, MAX_UPLOAD_ROWS).map((row, index) => {
    const out = { row: Number(row.row) || index + 1, feature: clean(row.feature, 200) };
    for (const column of spec.columns) if (column !== 'feature') out[column] = clean(row[column]);
    if (type === 'past_decision') out.decision = normalizeDecision(out.decision);
    return out;
  }).filter(row => row.feature && spec.required.every(column => row[column]) && (type !== 'past_decision' || DECISIONS.includes(row.decision)));
  if (!rows.length) throw new Error('No valid rows with an assigned feature.');
  return { type, vehicle, market, weight, fileName: clean(input.fileName, 120) || 'Pasted text', rows };
}

// Convert stored batches into engine inputs: feedback records, market/trend signals, past decisions.
export function toKnowledge(batches = []) {
  const records = [], signals = [], decisions = [];
  for (const batch of batches) {
    const factor = batch.weight / 5, file = `PM upload · ${batch.fileName}`;
    for (const row of batch.rows) {
      const evidenceId = `upload-${batch.batchId}-row-${row.row}`;
      if (batch.type === 'customer_feedback') {
        records.push({ evidenceId, feedbackId: evidenceId, sourceFile: file, sourceType: 'customer_feedback', sheet: 'PM upload', row: row.row, vehicle: batch.vehicle, market: batch.market, feedbackType: row.feedback_type || 'PM upload', text: row.text, feature: row.feature, quality: 'high', weight: factor, uploaded: true, batchId: batch.batchId });
      } else if (batch.type === 'market_data' || batch.type === 'global_trend') {
        signals.push({ evidenceId, sourceFile: file, sourceType: batch.type === 'market_data' ? 'pm_market_data' : 'pm_global_trend', sheet: 'PM upload', row: row.row, vehicle: batch.vehicle, market: batch.market, feature: row.feature, text: row.text, source: row.source || row.source_url || '', weight: factor, batchId: batch.batchId });
      } else if (batch.type === 'past_decision') {
        decisions.push({ id: evidenceId, productCycle: row.product_cycle || 'Earlier product cycle', vehicle: batch.vehicle, market: batch.market, feature: row.feature, requirement: row.requirement, decisionStatus: row.decision, pmReasoning: row.reasoning, timestamp: batch.uploadedAt, provenance: `${file}, row ${row.row}`, weight: batch.weight, batchId: batch.batchId });
      }
    }
  }
  return { records, signals, decisions };
}
