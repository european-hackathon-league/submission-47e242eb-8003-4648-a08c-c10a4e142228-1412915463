const toPdfAscii = value => String(value)
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201C\u201D]/g, '"')
  .replace(/[\u2013\u2014]/g, '-')
  .replace(/\u2026/g, '...')
  .replace(/\u2022/g, '*')
  .replace(/[^\x20-\x7E\n\r\t]/g, '?');

const escapePdfString = value => toPdfAscii(value)
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)');

const wrapLine = (line, width) => {
  if (!line.trim()) return [''];
  const words = line.trim().split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    if (word.length > width) {
      if (current) lines.push(current);
      for (let offset = 0; offset < word.length; offset += width) lines.push(word.slice(offset, offset + width));
      current = '';
    } else if (!current) current = word;
    else if (`${current} ${word}`.length <= width) current += ` ${word}`;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines;
};

const pdfText = (text, x, y, size = 10, font = 'F1', color = '0.086 0.133 0.188') =>
  `BT\n/${font} ${size} Tf\n${color} rg\n${x} ${y} Td\n(${escapePdfString(text)}) Tj\nET`;

const compilePdf = pageStreams => {
  const objects = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
  const pageRefs = [];
  pageStreams.forEach((stream, pageIndex) => {
    const pageObject = 5 + pageIndex * 2;
    const contentObject = pageObject + 1;
    pageRefs.push(`${pageObject} 0 R`);
    objects[pageObject] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObject} 0 R >>`;
    objects[contentObject] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  objects[2] = `<< /Type /Pages /Count ${pageStreams.length} /Kids [${pageRefs.join(' ')}] >>`;

  const chunks = ['%PDF-1.4\n% PM PDF\n'];
  const offsets = [0];
  let cursor = chunks[0].length;
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = cursor;
    const chunk = `${index} 0 obj\n${objects[index]}\nendobj\n`;
    chunks.push(chunk);
    cursor += chunk.length;
  }
  const xrefOffset = cursor;
  chunks.push(`xref\n0 ${objects.length}\n0000000000 65535 f \n`);
  for (let index = 1; index < objects.length; index += 1) chunks.push(`${String(offsets[index]).padStart(10, '0')} 00000 n \n`);
  chunks.push(`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return new TextEncoder().encode(chunks.join(''));
};

export function createReportPdf({ title, subtitle = '', metadata = [], sections = [], footer = 'BMW Product Intelligence' }) {
  const bodyPages = [[]];
  let pageIndex = 0;
  let y = 718;
  const page = () => bodyPages[pageIndex];
  const newPage = () => { pageIndex += 1; bodyPages.push([]); y = 718; };
  const ensureSpace = height => { if (y - height < 58) newPage(); };

  if (metadata.length) {
    const columns = Math.min(metadata.length, 4);
    const columnWidth = 507 / columns;
    page().push('0.902 0.929 0.953 rg\n44 652 507 54 re f');
    metadata.slice(0, 4).forEach((entry, index) => {
      const x = 58 + columnWidth * index;
      if (index) page().push(`0.753 0.804 0.851 RG\n0.5 w\n${44 + columnWidth * index} 663 m\n${44 + columnWidth * index} 697 l\nS`);
      page().push(pdfText(String(entry.label).toUpperCase(), x, 688, 7, 'F2', '0.365 0.435 0.510'));
      const value = wrapLine(toPdfAscii(entry.value), Math.max(14, Math.floor(columnWidth / 5.7))).slice(0, 2);
      value.forEach((line, lineIndex) => page().push(pdfText(line, x, 671 - lineIndex * 11, 9.5, 'F2')));
    });
    y = 625;
  }

  const drawSection = (section, continued = false) => {
    ensureSpace(35);
    page().push(pdfText(`${section.title}${continued ? '  /  CONTINUED' : ''}`.toUpperCase(), 44, y, 9, 'F2', '0.110 0.412 0.831'));
    page().push(`0.753 0.804 0.851 RG\n0.6 w\n44 ${y - 10} m\n551 ${y - 10} l\nS`);
    y -= 30;
  };

  const drawItem = (item, section) => {
    const kickerLines = wrapLine(toPdfAscii(item.kicker || ''), 88).slice(0, 1);
    const titleLines = wrapLine(toPdfAscii(item.title || ''), 76);
    const detailLines = (item.details || []).flatMap(detail => wrapLine(toPdfAscii(detail), 91));
    const height = 23 + kickerLines.length * 10 + titleLines.length * 14 + detailLines.length * 11 + 12;
    if (y - height < 58) { newPage(); drawSection(section, true); }
    const bottom = y - height;
    page().push(`0.941 0.957 0.973 rg\n44 ${bottom} 507 ${height} re f`);
    page().push(`0.110 0.412 0.831 rg\n44 ${bottom} 3 ${height} re f`);
    let textY = y - 17;
    kickerLines.forEach(line => { page().push(pdfText(line.toUpperCase(), 59, textY, 7.5, 'F2', '0.365 0.435 0.510')); textY -= 11; });
    titleLines.forEach(line => { page().push(pdfText(line, 59, textY, 11.5, 'F2')); textY -= 14; });
    textY -= 2;
    detailLines.forEach(line => { page().push(pdfText(line, 59, textY, 8.5, 'F1', '0.290 0.353 0.420')); textY -= 11; });
    y = bottom - 10;
  };

  const normalizedSections = sections.length ? sections : [{ title: 'Report', items: [{ title: 'No report data is available.', details: [] }] }];
  normalizedSections.forEach(section => {
    drawSection(section);
    const items = section.items?.length ? section.items : [{ title: section.empty || 'No entries in this section.', details: [] }];
    items.forEach(item => drawItem(item, section));
    y -= 8;
  });

  const totalPages = bodyPages.length;
  const streams = bodyPages.map((body, index) => [
    '0.969 0.976 0.988 rg\n0 0 595 842 re f',
    '0.055 0.102 0.157 rg\n0 742 595 100 re f',
    '0.110 0.412 0.831 rg\n44 764 3 49 re f',
    pdfText('BMW PRODUCT INTELLIGENCE', 58, 812, 7.5, 'F2', '0.620 0.710 0.800'),
    pdfText(title, 58, 784, 20, 'F2', '1 1 1'),
    pdfText(subtitle, 58, 763, 9, 'F1', '0.800 0.855 0.910'),
    ...body,
    '0.753 0.804 0.851 RG\n0.5 w\n44 44 m\n551 44 l\nS',
    pdfText(footer, 44, 27, 7.5, 'F1', '0.365 0.435 0.510'),
    pdfText(`Page ${index + 1} of ${totalPages}`, 500, 27, 7.5, 'F1', '0.365 0.435 0.510')
  ].join('\n'));
  return compilePdf(streams);
}

export function createTextPdf(text, { title = 'PM report', footer = 'BMW Product Intelligence' } = {}) {
  const lines = toPdfAscii(text).replace(/\r\n?/g, '\n').split('\n').flatMap(line => wrapLine(line, 92));
  const linesPerPage = 49;
  const pages = [];
  for (let index = 0; index < Math.max(lines.length, 1); index += linesPerPage) pages.push(lines.slice(index, index + linesPerPage));

  const objects = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
  const pageRefs = [];

  pages.forEach((pageLines, pageIndex) => {
    const pageObject = 5 + pageIndex * 2;
    const contentObject = pageObject + 1;
    pageRefs.push(`${pageObject} 0 R`);
    const body = pageLines.map(line => `(${escapePdfString(line)}) Tj T*`).join('\n');
    const stream = `BT\n/F2 18 Tf\n48 794 Td\n(${escapePdfString(title)}) Tj\n/F1 9 Tf\n0 -28 Td\n13 TL\n${body}\nET\nBT\n/F1 8 Tf\n48 28 Td\n(${escapePdfString(`${footer}  |  Page ${pageIndex + 1} of ${pages.length}`)}) Tj\nET`;
    objects[pageObject] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObject} 0 R >>`;
    objects[contentObject] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageRefs.join(' ')}] >>`;

  const chunks = ['%PDF-1.4\n% PM PDF\n'];
  const offsets = [0];
  let cursor = chunks[0].length;
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = cursor;
    const chunk = `${index} 0 obj\n${objects[index]}\nendobj\n`;
    chunks.push(chunk);
    cursor += chunk.length;
  }
  const xrefOffset = cursor;
  chunks.push(`xref\n0 ${objects.length}\n0000000000 65535 f \n`);
  for (let index = 1; index < objects.length; index += 1) chunks.push(`${String(offsets[index]).padStart(10, '0')} 00000 n \n`);
  chunks.push(`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return new TextEncoder().encode(chunks.join(''));
}
