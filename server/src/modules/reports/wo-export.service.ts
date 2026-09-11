import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  ShadingType,
  PageOrientation,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  Tab,
  TabStopType,
  TabStopPosition,
  ImageRun,
  VerticalAlign,
  convertInchesToTwip,
} from 'docx';
import { getDb } from '../../database/connection';

function formatRow(result: any, index: number = 0): any {
  if (!result[0] || !result[0].values[index]) return null;
  const obj: any = {};
  result[0].columns.forEach((col: string, i: number) => {
    obj[col] = result[0].values[index][i];
  });
  return obj;
}

function formatRows(result: any): any[] {
  if (!result[0]) return [];
  return result[0].values.map((row: any[]) => {
    const obj: any = {};
    result[0].columns.forEach((col: string, i: number) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTime(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const COLORS = {
  primary: '1e40af',
  headerBg: '1e3a8a',
  headerText: 'FFFFFF',
  lightBg: 'f1f5f9',
  border: 'cbd5e1',
  green: '15803d',
  red: 'dc2626',
  orange: 'ea580c',
  blue: '2563eb',
  gray: '64748b',
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: COLORS.red,
  HIGH: COLORS.orange,
  MEDIUM: COLORS.blue,
  LOW: COLORS.green,
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: COLORS.blue,
  ASSIGNED: COLORS.orange,
  IN_PROGRESS: COLORS.orange,
  ON_HOLD: COLORS.red,
  CLOSED: COLORS.green,
};

function createCell(text: string, opts: {
  bold?: boolean;
  color?: string;
  shading?: string;
  width?: number;
  alignment?: typeof AlignmentType[keyof typeof AlignmentType];
  font_size?: number;
} = {}): TableCell {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts.shading ? {
      type: ShadingType.CLEAR,
      fill: opts.shading,
      color: 'auto',
    } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: opts.alignment || AlignmentType.LEFT,
        spacing: { before: 30, after: 30 },
        indent: { left: 60, right: 60 },
        children: [
          new TextRun({
            text: text || '-',
            bold: opts.bold,
            color: opts.color,
            size: opts.font_size || 16,
            font: 'Calibri',
          }),
        ],
      }),
    ],
  });
}

function createHeaderCell(text: string, width?: number): TableCell {
  return createCell(text, {
    bold: true,
    color: COLORS.headerText,
    shading: COLORS.headerBg,
    width,
    font_size: 16,
  });
}

function createSeparator(): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.border },
    },
    children: [],
  });
}

export class WoExportService {
  async generateWorkOrderReportDocx(filters: any = {}): Promise<Buffer> {
    const db = await getDb();

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (filters.startDate) { where += ` AND wo.createdAt >= ?`; params.push(filters.startDate); }
    if (filters.endDate) { where += ` AND wo.createdAt <= ?`; params.push(filters.endDate); }
    if (filters.status) { where += ` AND wo.status = ?`; params.push(filters.status); }
    if (filters.priority) { where += ` AND wo.priority = ?`; params.push(filters.priority); }
    if (filters.assignedToId) { where += ` AND wo.assignedToId = ?`; params.push(filters.assignedToId); }
    if (filters.assetId) { where += ` AND wo.assetId = ?`; params.push(filters.assetId); }

    const summaryResult = db.exec(
      `SELECT
        COUNT(*) as "totalWorkOrders",
        SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) as "openCount",
        SUM(CASE WHEN status = 'ASSIGNED' THEN 1 ELSE 0 END) as "assignedCount",
        SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as "inProgressCount",
        SUM(CASE WHEN status = 'ON_HOLD' THEN 1 ELSE 0 END) as "onHoldCount",
        SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END) as "closedCount"
       FROM work_orders wo ${where}`,
      params
    );
    const summary = formatRow(summaryResult) || {
      totalWorkOrders: 0, openCount: 0, assignedCount: 0,
      inProgressCount: 0, onHoldCount: 0, closedCount: 0,
    };

    const byPriorityResult = db.exec(
      `SELECT wo.priority, COUNT(*) as count
       FROM work_orders wo ${where}
       GROUP BY wo.priority ORDER BY count DESC`,
      params
    );
    const byPriority = formatRows(byPriorityResult);

    const byAssetResult = db.exec(
      `SELECT a.assetName, a.assetCode, COUNT(*) as count
       FROM work_orders wo
       LEFT JOIN assets a ON wo.assetId = a.id
       ${where}
       GROUP BY wo.assetId, a.assetName, a.assetCode
       ORDER BY count DESC`,
      params
    );
    const byAsset = formatRows(byAssetResult);

    const workOrdersResult = db.exec(
      `SELECT wo.id, wo.woNumber, wo.title, wo.priority, wo.status, wo.createdAt, wo.closedAt, wo.dueDate,
        wo.problemDescription, wo.rootCause, wo.workPerformed, wo.resolution,
        a.assetName, a.assetCode,
        u.name as assignedToName, r.name as reportedByName
       FROM work_orders wo
       LEFT JOIN assets a ON wo.assetId = a.id
       LEFT JOIN users u ON wo.assignedToId = u.id
       LEFT JOIN users r ON wo.reportedById = r.id
       ${where}
       ORDER BY wo.createdAt DESC`,
      params
    );
    const workOrders = formatRows(workOrdersResult);

    const now = new Date();
    const reportDate = now.toLocaleDateString('id-ID', {
      day: '2-digit', month: 'long', year: 'numeric',
    });

    let filterDesc = 'Semua Work Order';
    if (filters.startDate || filters.endDate || filters.status || filters.priority) {
      const parts: string[] = [];
      if (filters.startDate && filters.endDate) {
        parts.push(`Periode ${formatDate(filters.startDate)} - ${formatDate(filters.endDate)}`);
      } else if (filters.startDate) {
        parts.push(`Dari ${formatDate(filters.startDate)}`);
      } else if (filters.endDate) {
        parts.push(`Sampai ${formatDate(filters.endDate)}`);
      }
      if (filters.status) parts.push(`Status: ${filters.status}`);
      if (filters.priority) parts.push(`Prioritas: ${filters.priority}`);
      filterDesc = parts.join(', ');
    }

    const headerRow = new TableRow({
      tableHeader: true,
      children: [
        createHeaderCell('No.', 450),
        createHeaderCell('WO Number', 1200),
        createHeaderCell('Judul', 2000),
        createHeaderCell('Aset', 1500),
        createHeaderCell('Prioritas', 800),
        createHeaderCell('Status', 800),
        createHeaderCell('Ditugaskan', 1200),
        createHeaderCell('Tgl Dibuat', 900),
        createHeaderCell('Tgl Selesai', 900),
      ],
    });

    const dataRows = workOrders.map((wo: any, idx: number) => {
      const rowShading = idx % 2 === 0 ? COLORS.lightBg : undefined;
      return new TableRow({
        children: [
          createCell(String(idx + 1), { shading: rowShading, alignment: AlignmentType.CENTER, width: 450 }),
          createCell(wo.woNumber || '-', { bold: true, color: COLORS.primary, shading: rowShading, width: 1200 }),
          createCell(wo.title || '-', { shading: rowShading, width: 2000 }),
          createCell(wo.assetName ? `${wo.assetCode} - ${wo.assetName}` : '-', { shading: rowShading, width: 1500 }),
          createCell(wo.priority || '-', {
            bold: true,
            color: PRIORITY_COLORS[wo.priority] || COLORS.gray,
            shading: rowShading,
            width: 800,
            alignment: AlignmentType.CENTER,
          }),
          createCell((wo.status || '-').replace('_', ' '), {
            bold: true,
            color: STATUS_COLORS[wo.status] || COLORS.gray,
            shading: rowShading,
            width: 800,
            alignment: AlignmentType.CENTER,
          }),
          createCell(wo.assignedToName || '-', { shading: rowShading, width: 1200 }),
          createCell(formatDate(wo.createdAt), { shading: rowShading, width: 900 }),
          createCell(formatDate(wo.closedAt), { shading: rowShading, width: 900 }),
        ],
      });
    });

    const priorityRows = byPriority.map((p: any) => {
      const pct = summary.totalWorkOrders > 0
        ? Math.round((p.count / summary.totalWorkOrders) * 100)
        : 0;
      return new TableRow({
        children: [
          createCell(p.priority || '-', { bold: true, color: PRIORITY_COLORS[p.priority] || COLORS.gray }),
          createCell(String(p.count), { alignment: AlignmentType.CENTER }),
          createCell(`${pct}%`, { alignment: AlignmentType.CENTER }),
        ],
      });
    });

    const assetRows = byAsset.map((a: any, idx: number) => {
      const rowShading = idx % 2 === 0 ? COLORS.lightBg : undefined;
      return new TableRow({
        children: [
          createCell(`${a.assetCode || ''} - ${a.assetName || '-'}`, { shading: rowShading }),
          createCell(String(a.count), { shading: rowShading, alignment: AlignmentType.CENTER }),
        ],
      });
    });

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: 'Calibri', size: 22 },
          },
        },
      },
      sections: [{
        properties: {
          page: {
            size: { orientation: PageOrientation.PORTRAIT },
            margin: {
              top: convertInchesToTwip(0.8),
              bottom: convertInchesToTwip(0.8),
              left: convertInchesToTwip(0.8),
              right: convertInchesToTwip(0.8),
            },
          },
        },
        headers: {
          default: new Header({
            children: [],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                border: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
                },
                children: [
                  new TextRun({
                    text: 'Halaman ',
                    color: COLORS.gray,
                    size: 16,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    color: COLORS.gray,
                    size: 16,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    text: ' | Dicetak: ',
                    color: COLORS.gray,
                    size: 16,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    text: formatDateTime(now.toISOString()),
                    color: COLORS.gray,
                    size: 16,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // === HEADER / TITLE ===
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: 'WORK ORDER REPORT',
                bold: true,
                size: 32,
                color: COLORS.primary,
                font: 'Calibri',
              }),
            ],
          }),
          createSeparator(),

          // === INFO BOX ===
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: 'eff6ff', color: 'auto' },
                    children: [
                      new Paragraph({
                        spacing: { before: 80, after: 40 },
                        indent: { left: 120 },
                        children: [
                          new TextRun({ text: 'Periode Laporan', bold: true, size: 18, color: COLORS.primary, font: 'Calibri' }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { after: 80 },
                        indent: { left: 120 },
                        children: [
                          new TextRun({ text: filterDesc, size: 18, font: 'Calibri' }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: 'f0fdf4', color: 'auto' },
                    children: [
                      new Paragraph({
                        spacing: { before: 80, after: 40 },
                        indent: { left: 120 },
                        children: [
                          new TextRun({ text: 'Total Work Orders', bold: true, size: 18, color: COLORS.green, font: 'Calibri' }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { after: 80 },
                        indent: { left: 120 },
                        children: [
                          new TextRun({ text: String(summary.totalWorkOrders), bold: true, size: 28, font: 'Calibri' }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          // === SUMMARY ===
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 },
            children: [
              new TextRun({
                text: '1. Ringkasan Status',
                bold: true,
                size: 24,
                color: COLORS.primary,
                font: 'Calibri',
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                tableHeader: true,
                children: [
                  createHeaderCell('Status'),
                  createHeaderCell('Jumlah'),
                  createHeaderCell('Persentase'),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Open', { bold: true, color: COLORS.blue }),
                  createCell(String(summary.openCount), { alignment: AlignmentType.CENTER }),
                  createCell(`${summary.totalWorkOrders > 0 ? Math.round((summary.openCount / summary.totalWorkOrders) * 100) : 0}%`, { alignment: AlignmentType.CENTER }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Assigned', { bold: true, color: COLORS.orange }),
                  createCell(String(summary.assignedCount), { shading: COLORS.lightBg, alignment: AlignmentType.CENTER }),
                  createCell(`${summary.totalWorkOrders > 0 ? Math.round((summary.assignedCount / summary.totalWorkOrders) * 100) : 0}%`, { shading: COLORS.lightBg, alignment: AlignmentType.CENTER }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('In Progress', { bold: true, color: COLORS.orange }),
                  createCell(String(summary.inProgressCount), { alignment: AlignmentType.CENTER }),
                  createCell(`${summary.totalWorkOrders > 0 ? Math.round((summary.inProgressCount / summary.totalWorkOrders) * 100) : 0}%`, { alignment: AlignmentType.CENTER }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('On Hold', { bold: true, color: COLORS.red }),
                  createCell(String(summary.onHoldCount), { shading: COLORS.lightBg, alignment: AlignmentType.CENTER }),
                  createCell(`${summary.totalWorkOrders > 0 ? Math.round((summary.onHoldCount / summary.totalWorkOrders) * 100) : 0}%`, { shading: COLORS.lightBg, alignment: AlignmentType.CENTER }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Closed', { bold: true, color: COLORS.green }),
                  createCell(String(summary.closedCount), { alignment: AlignmentType.CENTER }),
                  createCell(`${summary.totalWorkOrders > 0 ? Math.round((summary.closedCount / summary.totalWorkOrders) * 100) : 0}%`, { alignment: AlignmentType.CENTER }),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Total', { bold: true, shading: COLORS.lightBg }),
                  createCell(String(summary.totalWorkOrders), { bold: true, shading: COLORS.lightBg, alignment: AlignmentType.CENTER }),
                  createCell('100%', { bold: true, shading: COLORS.lightBg, alignment: AlignmentType.CENTER }),
                ],
              }),
            ],
          }),

          // === BREAKDOWN BY PRIORITY ===
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 },
            children: [
              new TextRun({
                text: '2. Breakdown berdasarkan Prioritas',
                bold: true,
                size: 24,
                color: COLORS.primary,
                font: 'Calibri',
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                tableHeader: true,
                children: [
                  createHeaderCell('Prioritas'),
                  createHeaderCell('Jumlah'),
                  createHeaderCell('Persentase'),
                ],
              }),
              ...priorityRows,
            ],
          }),

          // === BREAKDOWN BY ASSET ===
          ...(byAsset.length > 0 ? [
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 150 },
              children: [
                new TextRun({
                  text: '3. Breakdown berdasarkan Aset',
                  bold: true,
                  size: 24,
                  color: COLORS.primary,
                  font: 'Calibri',
                }),
              ],
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  tableHeader: true,
                  children: [
                    createHeaderCell('Aset'),
                    createHeaderCell('Jumlah WO'),
                  ],
                }),
                ...assetRows,
              ],
            }),
          ] : []),

          // === DETAIL WORK ORDERS ===
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 },
            children: [
              new TextRun({
                text: '4. Detail Work Orders',
                bold: true,
                size: 24,
                color: COLORS.primary,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: `Total: ${workOrders.length} Work Orders`,
                size: 18,
                color: COLORS.gray,
                font: 'Calibri',
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              headerRow,
              ...dataRows,
            ],
          }),

          // === SIGNATURE SECTION ===
          new Paragraph({ spacing: { before: 500 }, children: [] }),
          createSeparator(),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 300 },
            children: [
              new TextRun({
                text: 'Tanda Tangan',
                bold: true,
                size: 24,
                color: COLORS.primary,
                font: 'Calibri',
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 33, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                    },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 600 },
                        children: [
                          new TextRun({ text: 'Disiapkan oleh:', size: 18, color: COLORS.gray, font: 'Calibri' }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 40 },
                        children: [
                          new TextRun({ text: '_________________________', size: 18, font: 'Calibri' }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 40 },
                        children: [
                          new TextRun({ text: 'Petugas Maintenance', bold: true, size: 18, font: 'Calibri' }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: `Tanggal: ${reportDate}`, size: 16, color: COLORS.gray, font: 'Calibri' }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 33, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                    },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 600 },
                        children: [
                          new TextRun({ text: 'Diperiksa oleh:', size: 18, color: COLORS.gray, font: 'Calibri' }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 40 },
                        children: [
                          new TextRun({ text: '_________________________', size: 18, font: 'Calibri' }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 40 },
                        children: [
                          new TextRun({ text: 'Supervisor', bold: true, size: 18, font: 'Calibri' }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: `Tanggal: ${reportDate}`, size: 16, color: COLORS.gray, font: 'Calibri' }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 33, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                    },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 600 },
                        children: [
                          new TextRun({ text: 'Disetujui oleh:', size: 18, color: COLORS.gray, font: 'Calibri' }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 40 },
                        children: [
                          new TextRun({ text: '_________________________', size: 18, font: 'Calibri' }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 40 },
                        children: [
                          new TextRun({ text: 'Manager / Plant Head', bold: true, size: 18, font: 'Calibri' }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: `Tanggal: ${reportDate}`, size: 16, color: COLORS.gray, font: 'Calibri' }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          // === DISCLAIMER ===
          new Paragraph({ spacing: { before: 400 }, children: [] }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100 },
            border: {
              top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
            },
            children: [
              new TextRun({
                text: 'Dokumen ini dihasilkan secara otomatis oleh CMMS INDRA.',
                italics: true,
                size: 16,
                color: COLORS.gray,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'Laporan ini merupakan dokumen resmi untuk keperluan audit dan pelaporan pemeliharaan.',
                italics: true,
                size: 16,
                color: COLORS.gray,
                font: 'Calibri',
              }),
            ],
          }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    return buffer;
  }

  async generateSingleWorkOrderDocx(woId: string): Promise<Buffer> {
    const db = await getDb();

    const woResult = db.exec(
      `SELECT wo.*, a.assetName, a.assetCode, a.location as assetLocation,
        u1.name as reportedByName, u2.name as supervisorName, u3.name as assignedToName
       FROM work_orders wo
       LEFT JOIN assets a ON wo.assetId = a.id
       LEFT JOIN users u1 ON wo.reportedById = u1.id
       LEFT JOIN users u2 ON wo.supervisorId = u2.id
       LEFT JOIN users u3 ON wo.assignedToId = u3.id
       WHERE wo.id = ?`, [woId]
    );
    const wo = formatRow(woResult);
    if (!wo) throw new Error('Work Order not found');

    const histResult = db.exec(
      `SELECT h.*, u.name as changedByName FROM work_order_status_history h
       LEFT JOIN users u ON h.changedBy = u.id WHERE h.woId = ? ORDER BY h.createdAt ASC`, [woId]
    );
    const statusHistory = formatRows(histResult);

    const clResult = db.exec(
      `SELECT c.*, u.name as completedByName FROM work_order_checklists c
       LEFT JOIN users u ON c.completedBy = u.id WHERE c.woId = ? ORDER BY c.id`, [woId]
    );
    const checklists = formatRows(clResult);

    const spResult = db.exec(
      `SELECT wsp.*, sp.itemCode, sp.itemName FROM work_order_spare_parts wsp
       LEFT JOIN spare_parts sp ON wsp.itemId = sp.id WHERE wsp.woId = ?`, [woId]
    );
    const spareParts = formatRows(spResult);

    const now = new Date();
    const reportDate = now.toLocaleDateString('id-ID', {
      day: '2-digit', month: 'long', year: 'numeric',
    });

    const children: (Paragraph | Table)[] = [];

    // HEADER
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [
          new TextRun({ text: 'WORK ORDER REPORT', bold: true, size: 32, color: COLORS.primary, font: 'Calibri' }),
        ],
      }),
      createSeparator()
    );

    // WO INFO TABLE
    const infoRows = [
      ['WO Number', wo.woNumber || '-', 'Status', (wo.status || '-').replace('_', ' ')],
      ['Judul', wo.title || '-', 'Prioritas', wo.priority || '-'],
      ['Aset', wo.assetName ? `${wo.assetCode} - ${wo.assetName}` : '-', 'Lokasi', wo.assetLocation || wo.location || '-'],
      ['Dilaporkan oleh', wo.reportedByName || '-', 'Tanggal Dibuat', formatDate(wo.createdAt)],
      ['Ditugaskan ke', wo.assignedToName || '-', 'Supervisor', wo.supervisorName || '-'],
      ['Tgl Mulai', formatDateTime(wo.startedAt), 'Tgl Selesai', formatDateTime(wo.closedAt || wo.completedAt)],
    ];

    const infoTableRows = infoRows.map((row, idx) => {
      const shading = idx % 2 === 0 ? 'eff6ff' : undefined;
      return new TableRow({
        children: [
          createCell(row[0], { bold: true, shading, width: 2000 }),
          createCell(row[1], { shading, width: 3500 }),
          createCell(row[2], { bold: true, shading, width: 2000 }),
          createCell(row[3], { shading, width: 3500 }),
        ],
      });
    });

    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 150 },
        children: [
          new TextRun({ text: '1. Informasi Work Order', bold: true, size: 24, color: COLORS.primary, font: 'Calibri' }),
        ],
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: infoTableRows,
      })
    );

    // PROBLEM DESCRIPTION
    if (wo.problemDescription) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 },
          children: [
            new TextRun({ text: '2. Deskripsi Masalah', bold: true, size: 24, color: COLORS.primary, font: 'Calibri' }),
          ],
        }),
        new Paragraph({
          spacing: { after: 100 },
          indent: { left: 200 },
          children: [
            new TextRun({ text: wo.problemDescription, size: 20, font: 'Calibri' }),
          ],
        })
      );
    }

    // WORK PERFORMED / ROOT CAUSE / RESOLUTION
    const detailSections = [
      { title: 'Pekerjaan yang Dilakukan', value: wo.workPerformed },
      { title: 'Akar Masalah (Root Cause)', value: wo.rootCause },
      { title: 'Resolusi / Tindakan Perbaikan', value: wo.resolution },
      { title: 'Catatan', value: wo.notes },
    ].filter(s => s.value);

    if (detailSections.length > 0) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 },
          children: [
            new TextRun({ text: '3. Detail Pekerjaan', bold: true, size: 24, color: COLORS.primary, font: 'Calibri' }),
          ],
        })
      );
      for (const section of detailSections) {
        children.push(
          new Paragraph({
            spacing: { before: 100, after: 40 },
            indent: { left: 200 },
            children: [
              new TextRun({ text: `${section.title}:`, bold: true, size: 20, font: 'Calibri' }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            indent: { left: 400 },
            children: [
              new TextRun({ text: section.value, size: 20, font: 'Calibri' }),
            ],
          })
        );
      }
    }

    // CHECKLISTS
    if (checklists.length > 0) {
      const clHeaderRow = new TableRow({
        tableHeader: true,
        children: [
          createHeaderCell('No.', 600),
          createHeaderCell('Item Pekerjaan', 4500),
          createHeaderCell('Wajib', 1000),
          createHeaderCell('Status', 1200),
          createHeaderCell('Diselesaikan Oleh', 2000),
          createHeaderCell('Tanggal', 1500),
        ],
      });
      const clRows = checklists.map((cl: any, idx: number) => {
        const shading = idx % 2 === 0 ? COLORS.lightBg : undefined;
        return new TableRow({
          children: [
            createCell(String(idx + 1), { shading, alignment: AlignmentType.CENTER, width: 600 }),
            createCell(cl.title || cl.description || '-', { shading, width: 4500 }),
            createCell(cl.required ? 'Ya' : 'Tidak', { shading, width: 1000, alignment: AlignmentType.CENTER }),
            createCell(cl.completed ? 'Selesai' : 'Belum', {
              bold: true,
              color: cl.completed ? COLORS.green : COLORS.red,
              shading,
              width: 1200,
              alignment: AlignmentType.CENTER,
            }),
            createCell(cl.completedByName || '-', { shading, width: 2000 }),
            createCell(formatDateTime(cl.completedAt), { shading, width: 1500 }),
          ],
        });
      });

      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 },
          children: [
            new TextRun({ text: '4. Checklist Pekerjaan', bold: true, size: 24, color: COLORS.primary, font: 'Calibri' }),
          ],
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [clHeaderRow, ...clRows],
        })
      );
    }

    // SPARE PARTS
    if (spareParts.length > 0) {
      const spHeaderRow = new TableRow({
        tableHeader: true,
        children: [
          createHeaderCell('No.', 600),
          createHeaderCell('Kode Item', 1500),
          createHeaderCell('Nama Item', 2500),
          createHeaderCell('Qty Direncanakan', 1500),
          createHeaderCell('Qty Digunakan', 1500),
          createHeaderCell('Satuan', 1000),
          createHeaderCell('Harga Satuan', 1500),
          createHeaderCell('Total Biaya', 1500),
        ],
      });
      const spRows = spareParts.map((sp: any, idx: number) => {
        const shading = idx % 2 === 0 ? COLORS.lightBg : undefined;
        return new TableRow({
          children: [
            createCell(String(idx + 1), { shading, alignment: AlignmentType.CENTER, width: 600 }),
            createCell(sp.itemCode || '-', { shading, width: 1500 }),
            createCell(sp.itemName || '-', { shading, width: 2500 }),
            createCell(String(sp.plannedQuantity || 0), { shading, width: 1500, alignment: AlignmentType.CENTER }),
            createCell(String(sp.usedQuantity || 0), { shading, width: 1500, alignment: AlignmentType.CENTER }),
            createCell(sp.unit || '-', { shading, width: 1000, alignment: AlignmentType.CENTER }),
            createCell(sp.unitCost ? `Rp ${Number(sp.unitCost).toLocaleString('id-ID')}` : '-', { shading, width: 1500, alignment: AlignmentType.RIGHT }),
            createCell(sp.totalCost ? `Rp ${Number(sp.totalCost).toLocaleString('id-ID')}` : '-', { shading, width: 1500, alignment: AlignmentType.RIGHT }),
          ],
        });
      });

      const totalCost = spareParts.reduce((sum: number, sp: any) => sum + (Number(sp.totalCost) || 0), 0);
      spRows.push(
        new TableRow({
          children: [
            createCell('', { shading: COLORS.lightBg, width: 600 }),
            createCell('', { shading: COLORS.lightBg, width: 1500 }),
            createCell('', { shading: COLORS.lightBg, width: 2500 }),
            createCell('', { shading: COLORS.lightBg, width: 1500 }),
            createCell('', { shading: COLORS.lightBg, width: 1500 }),
            createCell('TOTAL', { bold: true, shading: COLORS.lightBg, width: 1000 }),
            createCell('', { shading: COLORS.lightBg, width: 1500 }),
            createCell(`Rp ${totalCost.toLocaleString('id-ID')}`, { bold: true, shading: COLORS.lightBg, width: 1500, alignment: AlignmentType.RIGHT }),
          ],
        })
      );

      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 },
          children: [
            new TextRun({ text: '5. Spare Parts yang Digunakan', bold: true, size: 24, color: COLORS.primary, font: 'Calibri' }),
          ],
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [spHeaderRow, ...spRows],
        })
      );
    }

    // STATUS HISTORY
    if (statusHistory.length > 0) {
      const shHeaderRow = new TableRow({
        tableHeader: true,
        children: [
          createHeaderCell('No.', 600),
          createHeaderCell('Dari Status', 2000),
          createHeaderCell('Ke Status', 2000),
          createHeaderCell('Diubah Oleh', 2500),
          createHeaderCell('Catatan', 3000),
          createHeaderCell('Tanggal', 2000),
        ],
      });
      const shRows = statusHistory.map((sh: any, idx: number) => {
        const shading = idx % 2 === 0 ? COLORS.lightBg : undefined;
        return new TableRow({
          children: [
            createCell(String(idx + 1), { shading, alignment: AlignmentType.CENTER, width: 600 }),
            createCell(sh.fromStatus || '-', { shading, width: 2000 }),
            createCell(sh.toStatus || '-', { bold: true, shading, width: 2000 }),
            createCell(sh.changedByName || '-', { shading, width: 2500 }),
            createCell(sh.notes || '-', { shading, width: 3000 }),
            createCell(formatDateTime(sh.createdAt), { shading, width: 2000 }),
          ],
        });
      });

      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 },
          children: [
            new TextRun({ text: '6. Riwayat Perubahan Status', bold: true, size: 24, color: COLORS.primary, font: 'Calibri' }),
          ],
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [shHeaderRow, ...shRows],
        })
      );
    }

    // SIGNATURE
    children.push(
      new Paragraph({ spacing: { before: 500 }, children: [] }),
      createSeparator(),
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 300 },
        children: [
          new TextRun({ text: 'Tanda Tangan', bold: true, size: 24, color: COLORS.primary, font: 'Calibri' }),
        ],
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 33, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                },
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: 'Dikerjakan oleh:', size: 18, color: COLORS.gray, font: 'Calibri' })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: '_________________________', size: 18, font: 'Calibri' })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: wo.assignedToName || 'Teknisi', bold: true, size: 18, font: 'Calibri' })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Tanggal: ${reportDate}`, size: 16, color: COLORS.gray, font: 'Calibri' })] }),
                ],
              }),
              new TableCell({
                width: { size: 33, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                },
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: 'Diperiksa oleh:', size: 18, color: COLORS.gray, font: 'Calibri' })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: '_________________________', size: 18, font: 'Calibri' })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: wo.supervisorName || 'Supervisor', bold: true, size: 18, font: 'Calibri' })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Tanggal: ${reportDate}`, size: 16, color: COLORS.gray, font: 'Calibri' })] }),
                ],
              }),
              new TableCell({
                width: { size: 33, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                },
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: 'Disetujui oleh:', size: 18, color: COLORS.gray, font: 'Calibri' })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: '_________________________', size: 18, font: 'Calibri' })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: 'Manager / Plant Head', bold: true, size: 18, font: 'Calibri' })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Tanggal: ${reportDate}`, size: 16, color: COLORS.gray, font: 'Calibri' })] }),
                ],
              }),
            ],
          }),
        ],
      }),
      new Paragraph({ spacing: { before: 400 }, children: [] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100 },
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border } },
        children: [
          new TextRun({ text: 'Dokumen ini dihasilkan secara otomatis oleh CMMS INDRA.', italics: true, size: 16, color: COLORS.gray, font: 'Calibri' }),
        ],
      })
    );

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: 'Calibri', size: 22 },
          },
        },
      },
      sections: [{
        properties: {
          page: {
            size: { orientation: PageOrientation.PORTRAIT },
            margin: {
              top: convertInchesToTwip(0.8),
              bottom: convertInchesToTwip(0.8),
              left: convertInchesToTwip(0.8),
              right: convertInchesToTwip(0.8),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: `WO: ${wo.woNumber}`, bold: true, italics: true, color: COLORS.primary, size: 16, font: 'Calibri' }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                border: { top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border } },
                children: [
                  new TextRun({ text: 'Halaman ', color: COLORS.gray, size: 16, font: 'Calibri' }),
                  new TextRun({ children: [PageNumber.CURRENT], color: COLORS.gray, size: 16, font: 'Calibri' }),
                  new TextRun({ text: ` | Dicetak: ${formatDateTime(now.toISOString())}`, color: COLORS.gray, size: 16, font: 'Calibri' }),
                ],
              }),
            ],
          }),
        },
        children,
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    return buffer;
  }
}

export const woExportService = new WoExportService();
