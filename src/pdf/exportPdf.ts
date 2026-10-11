/**
 * Genuine client-side PDF generation (jsPDF + jspdf-autotable), drawn from the
 * same CustomerDocument model as the live preview so content always matches.
 * Lazy-loaded: this module and its embedded font are only fetched on demand
 * (and pre-warmed when the app is idle so it also works offline).
 *
 * Layout guarantees: table header repeats on every page, rows never split
 * across pages, the totals block and signature block are kept together, and
 * every page gets a footer with "Page X of Y".
 */
import { jsPDF } from 'jspdf';
import { autoTable, type CellHookData } from 'jspdf-autotable';
import type { CustomerDocument, DocLine } from '../domain/customerDocument';
import { PDF_FONT_RANGES } from './fontCoverage';
import interBoldUrl from './fonts/Inter-Bold.ttf?inline';
import interRegularUrl from './fonts/Inter-Regular.ttf?inline';

export interface PdfResult {
  blob: Blob;
  filename: string;
  pageCount: number;
  warnings: string[];
}

type RGB = [number, number, number];
const INK: RGB = [23, 35, 28];
const MUTED: RGB = [95, 107, 99];
const RULE: RGB = [225, 233, 226];
const SOFT: RGB = [246, 249, 247];

function hexToRgb(hex: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  const n = m?.[1] ? parseInt(m[1], 16) : 0x16845b;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function tint([r, g, b]: RGB, amount: number): RGB {
  return [r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount].map(Math.round) as RGB;
}

const base64Of = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(',') + 1);

/** Characters in the document the embedded PDF font cannot draw. */
export function unsupportedCharacters(text: string): string[] {
  const missing = new Set<string>();
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < 32) continue;
    if (!PDF_FONT_RANGES.some(([a, b]) => cp >= a && cp <= b)) missing.add(ch);
  }
  return [...missing];
}

function documentText(doc: CustomerDocument): string {
  const lineText = (l: DocLine) => [l.name, l.description, l.quantity, l.unitPrice, l.amount, l.note].join(' ');
  return [
    doc.documentTitle,
    doc.business.name,
    doc.business.address,
    ...doc.business.contactLines,
    ...doc.meta.flatMap((m) => [m.label, m.value]),
    doc.title,
    ...(doc.customer?.lines ?? []),
    doc.serviceAddress,
    doc.scope,
    ...doc.lines.map(lineText),
    ...doc.optionalLines.map(lineText),
    ...[...doc.totals, ...doc.afterTotal].flatMap((t) => [t.label, t.value, t.note]),
    doc.total.value,
    ...doc.sections.flatMap((s) => [s.title, s.body]),
    doc.footer,
  ].join(' ');
}

async function toPngDataUrl(dataUrl: string): Promise<{ url: string; w: number; h: number }> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('logo failed to load'));
    img.src = dataUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const g = canvas.getContext('2d');
  if (!g || !canvas.width) throw new Error('canvas unavailable');
  g.drawImage(img, 0, 0);
  return { url: canvas.toDataURL('image/png'), w: canvas.width, h: canvas.height };
}

export function pdfFileName(doc: CustomerDocument): string {
  const number = doc.meta[0]?.value ?? '';
  const safe = `${doc.documentTitle}-${number}`
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
  return `${safe || 'quote'}.pdf`;
}

export async function createQuotePdf(doc: CustomerDocument): Promise<PdfResult> {
  const warnings: string[] = [];
  const pdf = new jsPDF({ unit: 'pt', format: doc.paperSize === 'letter' ? 'letter' : 'a4', compress: true });

  let font = 'Inter';
  try {
    pdf.addFileToVFS('Inter-Regular.ttf', base64Of(interRegularUrl));
    pdf.addFont('Inter-Regular.ttf', 'Inter', 'normal');
    pdf.addFileToVFS('Inter-Bold.ttf', base64Of(interBoldUrl));
    pdf.addFont('Inter-Bold.ttf', 'Inter', 'bold');
    pdf.setFont('Inter', 'normal');
  } catch {
    font = 'helvetica';
    warnings.push('The document font could not be embedded, so a standard PDF font was used. Some characters may not display.');
  }
  const missing = unsupportedCharacters(documentText(doc));
  if (missing.length > 0) {
    warnings.push(
      `Some characters (${missing.slice(0, 6).join(' ')}) aren't included in the PDF font and may appear blank. Use Print / Save as PDF for full character support.`,
    );
  }

  const brand = hexToRgb(doc.brandColor);
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const M = 46; // side margin
  const TOP = 46;
  const BOTTOM = 62; // reserved for the footer
  const contentW = pageW - M * 2;
  const limit = pageH - BOTTOM;
  let y = TOP;

  const set = (size: number, weight: 'normal' | 'bold' = 'normal', color: RGB = INK) => {
    pdf.setFont(font, weight);
    pdf.setFontSize(size);
    pdf.setTextColor(color[0], color[1], color[2]);
  };
  const lh = (size: number) => size * 1.38;
  const newPage = () => {
    pdf.addPage();
    y = TOP;
  };
  const ensure = (h: number) => {
    if (y + h > limit) newPage();
  };
  const wrap = (text: string, width: number) => pdf.splitTextToSize(text, width) as string[];
  /** Paragraph text that may continue onto the next page line by line. */
  const paragraph = (text: string, x: number, width: number, size = 9.5, color: RGB = INK) => {
    set(size, 'normal', color);
    for (const raw of text.split(/\r?\n/)) {
      const lines = raw.trim() === '' ? [''] : wrap(raw, width);
      for (const line of lines) {
        ensure(lh(size));
        if (line) pdf.text(line, x, y, { baseline: 'top' });
        y += lh(size);
      }
    }
  };
  const label = (text: string, x: number, yy: number, align: 'left' | 'right' = 'left') => {
    set(7.5, 'bold', MUTED);
    pdf.setCharSpace(0.6);
    pdf.text(text.toUpperCase(), x, yy, { baseline: 'top', align });
    pdf.setCharSpace(0);
  };

  // ---- Brand bar & sample flag -------------------------------------------------
  pdf.setFillColor(brand[0], brand[1], brand[2]);
  pdf.rect(0, 0, pageW, 6, 'F');

  // ---- Header -------------------------------------------------------------------
  const leftW = contentW * 0.55;
  let leftY = y;
  if (doc.business.logoDataUrl) {
    try {
      const png = await toPngDataUrl(doc.business.logoDataUrl);
      const scale = Math.min(150 / png.w, 54 / png.h, 1);
      const w = png.w * scale;
      const h = png.h * scale;
      pdf.addImage(png.url, 'PNG', M, leftY, w, h, undefined, 'FAST');
      leftY += h + 10;
    } catch {
      warnings.push("Your logo couldn't be added to the PDF. The quote was created without it.");
    }
  }
  set(13, 'bold');
  for (const line of wrap(doc.business.name, leftW)) {
    pdf.text(line, M, leftY, { baseline: 'top' });
    leftY += lh(13);
  }
  leftY += 2;
  set(8.5, 'normal', MUTED);
  for (const line of [...doc.business.address.split(/\r?\n/), ...doc.business.contactLines].filter((l) => l.trim())) {
    for (const w of wrap(line, leftW)) {
      pdf.text(w, M, leftY, { baseline: 'top' });
      leftY += lh(8.5);
    }
  }

  let rightY = y;
  const right = pageW - M;
  set(22, 'bold', hexToRgb(doc.brandInk));
  pdf.text(doc.documentTitle, right, rightY - 2, { baseline: 'top', align: 'right' });
  rightY += 32;
  for (const m of doc.meta) {
    set(8.5, 'normal', MUTED);
    pdf.text(m.label, right - 120, rightY, { baseline: 'top', align: 'right' });
    set(8.5, 'bold');
    const value = wrap(m.value, 112);
    pdf.text(value, right, rightY, { baseline: 'top', align: 'right' });
    rightY += lh(8.5) * value.length + 2;
  }
  if (doc.isSample) {
    set(8, 'bold', [138, 90, 0]);
    pdf.text('SAMPLE DATA — FICTIONAL BUSINESS', right, rightY + 4, { baseline: 'top', align: 'right' });
    rightY += 16;
  }
  y = Math.max(leftY, rightY) + 14;
  pdf.setDrawColor(RULE[0], RULE[1], RULE[2]);
  pdf.setLineWidth(0.8);
  pdf.line(M, y, pageW - M, y);
  y += 16;

  // ---- Parties ---------------------------------------------------------------------
  const colW = contentW / 2 - 12;
  const partyBlock = (heading: string, lines: string[], x: number): number => {
    let yy = y;
    label(heading, x, yy);
    yy += 13;
    lines.forEach((line, i) => {
      set(9.5, i === 0 ? 'bold' : 'normal');
      for (const w of wrap(line, colW)) {
        pdf.text(w, x, yy, { baseline: 'top' });
        yy += lh(9.5);
      }
    });
    return yy;
  };
  let partiesEnd = y;
  if (doc.customer) partiesEnd = Math.max(partiesEnd, partyBlock(doc.customer.heading, doc.customer.lines, M));
  if (doc.serviceAddress) {
    partiesEnd = Math.max(partiesEnd, partyBlock('Service address', doc.serviceAddress.split(/\r?\n/).filter(Boolean), M + contentW / 2 + 12));
  }
  y = partiesEnd + (partiesEnd > y ? 16 : 0);

  // ---- Title & scope ----------------------------------------------------------------
  if (doc.title) {
    set(15, 'bold');
    for (const line of wrap(doc.title, contentW)) {
      ensure(lh(15));
      pdf.text(line, M, y, { baseline: 'top' });
      y += lh(15);
    }
    y += 6;
  }
  if (doc.scope) {
    ensure(40);
    label('Scope of work', M, y);
    y += 13;
    paragraph(doc.scope, M, contentW);
    y += 10;
  }

  // ---- Line items table ------------------------------------------------------------------
  const drawItemsTable = (lines: DocLine[], tint1: RGB) => {
    const qtyW = 74;
    const unitW = 82;
    const amountW = 86;
    const descW = doc.showQuantities ? contentW - qtyW - unitW - amountW : contentW - amountW;
    const pad = 7;
    const nameSize = 9.5;
    const descSize = 8.5;
    const cellLines = new Map<number, { name: string[]; detail: string[] }>();
    const body = lines.map((l, i) => {
      set(nameSize, 'bold');
      const name = wrap(l.name, descW - pad * 2);
      set(descSize);
      const detail = [l.description, l.note].filter(Boolean).flatMap((t) => t.split(/\r?\n/)).flatMap((t) => wrap(t, descW - pad * 2));
      cellLines.set(i, { name, detail });
      // Placeholder text with the right number of lines so autoTable sizes the row; drawn manually below.
      const filler = [...name, ...detail].map(() => ' ').join('\n');
      return doc.showQuantities ? [filler, l.quantity, l.unitPrice, l.amount] : [filler, l.amount];
    });
    const head = doc.showQuantities ? [['Description', 'Qty', 'Unit price', 'Amount']] : [['Description', 'Amount']];
    autoTable(pdf, {
      startY: y,
      head,
      body,
      theme: 'plain',
      showHead: 'everyPage',
      rowPageBreak: 'avoid',
      margin: { left: M, right: M, top: TOP, bottom: BOTTOM },
      styles: { font, fontSize: nameSize, textColor: INK, cellPadding: { top: pad, bottom: pad, left: pad, right: pad }, lineColor: RULE, lineWidth: { bottom: 0.6 }, valign: 'top' },
      headStyles: { fontStyle: 'bold', fontSize: 7.5, textColor: MUTED, fillColor: tint1, lineWidth: { bottom: 1.2 }, lineColor: brand },
      columnStyles: doc.showQuantities
        ? { 0: { cellWidth: descW }, 1: { cellWidth: qtyW, halign: 'right' }, 2: { cellWidth: unitW, halign: 'right' }, 3: { cellWidth: amountW, halign: 'right', fontStyle: 'bold' } }
        : { 0: { cellWidth: descW }, 1: { cellWidth: amountW, halign: 'right', fontStyle: 'bold' } },
      didParseCell: (data: CellHookData) => {
        if (data.section === 'head' && data.column.index > 0) data.cell.styles.halign = 'right';
        if (data.section === 'body' && data.column.index === 0) {
          const info = cellLines.get(data.row.index);
          if (info) {
            // Size the row for a bold name (9.5pt) plus smaller detail lines (8.5pt).
            const height = lh(nameSize) * info.name.length + lh(descSize) * info.detail.length + pad * 2 + (info.detail.length ? 2 : 0);
            data.cell.styles.minCellHeight = height;
            data.cell.text = [''];
          }
        }
      },
      didDrawCell: (data: CellHookData) => {
        if (data.section !== 'body' || data.column.index !== 0) return;
        const info = cellLines.get(data.row.index);
        if (!info) return;
        let yy = data.cell.y + pad;
        set(nameSize, 'bold');
        for (const line of info.name) {
          pdf.text(line, data.cell.x + pad, yy, { baseline: 'top' });
          yy += lh(nameSize);
        }
        if (info.detail.length) yy += 2;
        set(descSize, 'normal', MUTED);
        for (const line of info.detail) {
          pdf.text(line, data.cell.x + pad, yy, { baseline: 'top' });
          yy += lh(descSize);
        }
      },
    });
    y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
  };

  if (doc.lines.length > 0) drawItemsTable(doc.lines, SOFT);
  else {
    paragraph('No items have been added to this quote yet.', M, contentW, 9.5, MUTED);
    y += 8;
  }

  // ---- Totals (kept together) -------------------------------------------------------------------
  const totalsW = 250;
  const tx = pageW - M - totalsW;
  const rowH = 17;
  const noteH = (n: string) => (n ? wrap(n, totalsW - 10).length * lh(7.5) : 0);
  const totalsHeight =
    doc.totals.reduce((a, r) => a + rowH + noteH(r.note), 0) +
    34 +
    doc.afterTotal.length * rowH +
    (doc.deposit ? 54 : 0);
  ensure(totalsHeight);
  for (const row of doc.totals) {
    set(9, 'normal', MUTED);
    pdf.text(row.label, tx, y, { baseline: 'top' });
    set(9, row.kind === 'subtotal' ? 'bold' : 'normal', INK);
    pdf.text(row.value, pageW - M, y, { baseline: 'top', align: 'right' });
    y += rowH - 3;
    if (row.note) {
      set(7.5, 'normal', MUTED);
      for (const line of wrap(row.note, totalsW - 10)) {
        pdf.text(line, tx, y, { baseline: 'top' });
        y += lh(7.5);
      }
    }
    y += 3;
  }
  const totalBg = tint(brand, 0.88);
  pdf.setFillColor(totalBg[0], totalBg[1], totalBg[2]);
  pdf.roundedRect(tx - 8, y, totalsW + 8, 28, 4, 4, 'F');
  set(11, 'bold');
  pdf.text(doc.total.label, tx, y + 8.5, { baseline: 'top' });
  set(13, 'bold', INK);
  pdf.text(doc.total.value, pageW - M - 6, y + 7.5, { baseline: 'top', align: 'right' });
  y += 34;
  for (const row of doc.afterTotal) {
    set(8.5, 'normal', MUTED);
    pdf.text(row.label, tx, y, { baseline: 'top' });
    pdf.text(row.value, pageW - M, y, { baseline: 'top', align: 'right' });
    y += rowH - 2;
  }
  if (doc.deposit) {
    y += 4;
    pdf.setDrawColor(RULE[0], RULE[1], RULE[2]);
    pdf.setFillColor(SOFT[0], SOFT[1], SOFT[2]);
    pdf.roundedRect(tx - 8, y, totalsW + 8, 44, 4, 4, 'FD');
    set(8.5, 'normal', MUTED);
    pdf.text(doc.deposit.depositLabel, tx, y + 8, { baseline: 'top', maxWidth: totalsW - 80 });
    set(9.5, 'bold');
    pdf.text(doc.deposit.deposit, pageW - M - 6, y + 8, { baseline: 'top', align: 'right' });
    set(8.5, 'normal', MUTED);
    pdf.text(doc.deposit.balanceLabel, tx, y + 26, { baseline: 'top' });
    set(9.5, 'bold');
    pdf.text(doc.deposit.balance, pageW - M - 6, y + 26, { baseline: 'top', align: 'right' });
    y += 50;
  }
  y += 14;

  // ---- Optional extras -----------------------------------------------------------------------------
  if (doc.optionalLines.length > 0) {
    ensure(70);
    label('Optional extras', M, y);
    y += 14;
    drawItemsTable(doc.optionalLines, [255, 255, 255]);
    y -= 6;
    paragraph(doc.optionalNote, M, contentW, 8, MUTED);
    y += 12;
  }

  // ---- Text sections ---------------------------------------------------------------------------------
  for (const s of doc.sections) {
    // Keep the heading with at least its first lines (up to 3) — never a heading alone at a page end.
    set(9.5);
    const bodyLines = s.body.split(/\r?\n/).flatMap((t) => (t.trim() ? wrap(t, contentW) : ['']));
    ensure(13 + lh(9.5) * Math.min(bodyLines.length, 3));
    label(s.title, M, y);
    y += 13;
    paragraph(s.body, M, contentW);
    y += 12;
  }

  // ---- Signature (kept together) ---------------------------------------------------------------------
  if (doc.showSignature) {
    // Heading + signature lines + captions (≈62pt) are kept together.
    ensure(66);
    label('Customer acceptance', M, y);
    y += 30;
    const fieldW = (contentW - 40) / 3;
    ['Name', 'Signature', 'Date'].forEach((f, i) => {
      const x = M + i * (fieldW + 20);
      pdf.setDrawColor(INK[0], INK[1], INK[2]);
      pdf.setLineWidth(0.6);
      pdf.line(x, y + 18, x + fieldW, y + 18);
      set(8, 'normal', MUTED);
      pdf.text(f, x, y + 22, { baseline: 'top' });
    });
    y += 48;
  }

  // ---- Footer & page numbers on every page --------------------------------------------------------------
  const pages = pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);
    if (p > 1) {
      pdf.setFillColor(brand[0], brand[1], brand[2]);
      pdf.rect(0, 0, pageW, 3, 'F');
    }
    const fy = pageH - BOTTOM + 22;
    pdf.setDrawColor(RULE[0], RULE[1], RULE[2]);
    pdf.setLineWidth(0.6);
    pdf.line(M, fy - 8, pageW - M, fy - 8);
    set(7.5, 'normal', MUTED);
    const footerLines = doc.footer ? wrap(doc.footer, contentW - 90).slice(0, 2) : [];
    footerLines.forEach((line, i) => pdf.text(line, M, fy + i * lh(7.5), { baseline: 'top' }));
    pdf.text(`Page ${p} of ${pages}`, pageW - M, fy, { baseline: 'top', align: 'right' });
  }

  pdf.setProperties({ title: `${doc.documentTitle} ${doc.meta[0]?.value ?? ''}`.trim(), creator: 'TradeMaker', subject: doc.title });
  return { blob: pdf.output('blob'), filename: pdfFileName(doc), pageCount: pages, warnings };
}
