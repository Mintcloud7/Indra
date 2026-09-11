"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.woExportService = exports.WoExportService = void 0;
const docx_1 = require("docx");
const connection_1 = require("../../database/connection");
function formatRow(result, index = 0) {
    if (!result[0] || !result[0].values[index])
        return null;
    const obj = {};
    result[0].columns.forEach((col, i) => {
        obj[col] = result[0].values[index][i];
    });
    return obj;
}
function formatRows(result) {
    if (!result[0])
        return [];
    return result[0].values.map((row) => {
        const obj = {};
        result[0].columns.forEach((col, i) => {
            obj[col] = row[i];
        });
        return obj;
    });
}
function formatDate(dateString) {
    if (!dateString)
        return '-';
    return new Date(dateString).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
}
function formatDateTime(dateString) {
    if (!dateString)
        return '-';
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
const PRIORITY_COLORS = {
    CRITICAL: COLORS.red,
    HIGH: COLORS.orange,
    MEDIUM: COLORS.blue,
    LOW: COLORS.green,
};
const STATUS_COLORS = {
    OPEN: COLORS.blue,
    ASSIGNED: COLORS.orange,
    IN_PROGRESS: COLORS.orange,
    ON_HOLD: COLORS.red,
    CLOSED: COLORS.green,
};
function createCell(text, opts = {}) {
    return new docx_1.TableCell({
        width: opts.width ? { size: opts.width, type: docx_1.WidthType.DXA } : undefined,
        shading: opts.shading ? {
            type: docx_1.ShadingType.CLEAR,
            fill: opts.shading,
            color: 'auto',
        } : undefined,
        verticalAlign: docx_1.VerticalAlign.CENTER,
        children: [
            new docx_1.Paragraph({
                alignment: opts.alignment || docx_1.AlignmentType.LEFT,
                spacing: { before: 30, after: 30 },
                indent: { left: 60, right: 60 },
                children: [
                    new docx_1.TextRun({
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
function createHeaderCell(text, width) {
    return createCell(text, {
        bold: true,
        color: COLORS.headerText,
        shading: COLORS.headerBg,
        width,
        font_size: 16,
    });
}
function createSeparator() {
    return new docx_1.Paragraph({
        spacing: { before: 200, after: 200 },
        border: {
            bottom: { style: docx_1.BorderStyle.SINGLE, size: 6, color: COLORS.border },
        },
        children: [],
    });
}
class WoExportService {
    async generateWorkOrderReportDocx(filters = {}) {
        const db = await (0, connection_1.getDb)();
        let where = 'WHERE 1=1';
        const params = [];
        if (filters.startDate) {
            where += ` AND wo.createdAt >= ?`;
            params.push(filters.startDate);
        }
        if (filters.endDate) {
            where += ` AND wo.createdAt <= ?`;
            params.push(filters.endDate);
        }
        if (filters.status) {
            where += ` AND wo.status = ?`;
            params.push(filters.status);
        }
        if (filters.priority) {
            where += ` AND wo.priority = ?`;
            params.push(filters.priority);
        }
        if (filters.assignedToId) {
            where += ` AND wo.assignedToId = ?`;
            params.push(filters.assignedToId);
        }
        if (filters.assetId) {
            where += ` AND wo.assetId = ?`;
            params.push(filters.assetId);
        }
        const summaryResult = db.exec(`SELECT
        COUNT(*) as "totalWorkOrders",
        SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) as "openCount",
        SUM(CASE WHEN status = 'ASSIGNED' THEN 1 ELSE 0 END) as "assignedCount",
        SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as "inProgressCount",
        SUM(CASE WHEN status = 'ON_HOLD' THEN 1 ELSE 0 END) as "onHoldCount",
        SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END) as "closedCount"
       FROM work_orders wo ${where}`, params);
        const summary = formatRow(summaryResult) || {
            totalWorkOrders: 0, openCount: 0, assignedCount: 0,
            inProgressCount: 0, onHoldCount: 0, closedCount: 0,
        };
        const byPriorityResult = db.exec(`SELECT wo.priority, COUNT(*) as count
       FROM work_orders wo ${where}
       GROUP BY wo.priority ORDER BY count DESC`, params);
        const byPriority = formatRows(byPriorityResult);
        const byAssetResult = db.exec(`SELECT a.assetName, a.assetCode, COUNT(*) as count
       FROM work_orders wo
       LEFT JOIN assets a ON wo.assetId = a.id
       ${where}
       GROUP BY wo.assetId, a.assetName, a.assetCode
       ORDER BY count DESC`, params);
        const byAsset = formatRows(byAssetResult);
        const workOrdersResult = db.exec(`SELECT wo.id, wo.woNumber, wo.title, wo.priority, wo.status, wo.createdAt, wo.closedAt, wo.dueDate,
        wo.problemDescription, wo.rootCause, wo.workPerformed, wo.resolution,
        a.assetName, a.assetCode,
        u.name as assignedToName, r.name as reportedByName
       FROM work_orders wo
       LEFT JOIN assets a ON wo.assetId = a.id
       LEFT JOIN users u ON wo.assignedToId = u.id
       LEFT JOIN users r ON wo.reportedById = r.id
       ${where}
       ORDER BY wo.createdAt DESC`, params);
        const workOrders = formatRows(workOrdersResult);
        const now = new Date();
        const reportDate = now.toLocaleDateString('id-ID', {
            day: '2-digit', month: 'long', year: 'numeric',
        });
        let filterDesc = 'Semua Work Order';
        if (filters.startDate || filters.endDate || filters.status || filters.priority) {
            const parts = [];
            if (filters.startDate && filters.endDate) {
                parts.push(`Periode ${formatDate(filters.startDate)} - ${formatDate(filters.endDate)}`);
            }
            else if (filters.startDate) {
                parts.push(`Dari ${formatDate(filters.startDate)}`);
            }
            else if (filters.endDate) {
                parts.push(`Sampai ${formatDate(filters.endDate)}`);
            }
            if (filters.status)
                parts.push(`Status: ${filters.status}`);
            if (filters.priority)
                parts.push(`Prioritas: ${filters.priority}`);
            filterDesc = parts.join(', ');
        }
        const headerRow = new docx_1.TableRow({
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
        const dataRows = workOrders.map((wo, idx) => {
            const rowShading = idx % 2 === 0 ? COLORS.lightBg : undefined;
            return new docx_1.TableRow({
                children: [
                    createCell(String(idx + 1), { shading: rowShading, alignment: docx_1.AlignmentType.CENTER, width: 450 }),
                    createCell(wo.woNumber || '-', { bold: true, color: COLORS.primary, shading: rowShading, width: 1200 }),
                    createCell(wo.title || '-', { shading: rowShading, width: 2000 }),
                    createCell(wo.assetName ? `${wo.assetCode} - ${wo.assetName}` : '-', { shading: rowShading, width: 1500 }),
                    createCell(wo.priority || '-', {
                        bold: true,
                        color: PRIORITY_COLORS[wo.priority] || COLORS.gray,
                        shading: rowShading,
                        width: 800,
                        alignment: docx_1.AlignmentType.CENTER,
                    }),
                    createCell((wo.status || '-').replace('_', ' '), {
                        bold: true,
                        color: STATUS_COLORS[wo.status] || COLORS.gray,
                        shading: rowShading,
                        width: 800,
                        alignment: docx_1.AlignmentType.CENTER,
                    }),
                    createCell(wo.assignedToName || '-', { shading: rowShading, width: 1200 }),
                    createCell(formatDate(wo.createdAt), { shading: rowShading, width: 900 }),
                    createCell(formatDate(wo.closedAt), { shading: rowShading, width: 900 }),
                ],
            });
        });
        const priorityRows = byPriority.map((p) => {
            const pct = summary.totalWorkOrders > 0
                ? Math.round((p.count / summary.totalWorkOrders) * 100)
                : 0;
            return new docx_1.TableRow({
                children: [
                    createCell(p.priority || '-', { bold: true, color: PRIORITY_COLORS[p.priority] || COLORS.gray }),
                    createCell(String(p.count), { alignment: docx_1.AlignmentType.CENTER }),
                    createCell(`${pct}%`, { alignment: docx_1.AlignmentType.CENTER }),
                ],
            });
        });
        const assetRows = byAsset.map((a, idx) => {
            const rowShading = idx % 2 === 0 ? COLORS.lightBg : undefined;
            return new docx_1.TableRow({
                children: [
                    createCell(`${a.assetCode || ''} - ${a.assetName || '-'}`, { shading: rowShading }),
                    createCell(String(a.count), { shading: rowShading, alignment: docx_1.AlignmentType.CENTER }),
                ],
            });
        });
        const doc = new docx_1.Document({
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
                            size: { orientation: docx_1.PageOrientation.PORTRAIT },
                            margin: {
                                top: (0, docx_1.convertInchesToTwip)(0.8),
                                bottom: (0, docx_1.convertInchesToTwip)(0.8),
                                left: (0, docx_1.convertInchesToTwip)(0.8),
                                right: (0, docx_1.convertInchesToTwip)(0.8),
                            },
                        },
                    },
                    headers: {
                        default: new docx_1.Header({
                            children: [
                                new docx_1.Paragraph({
                                    alignment: docx_1.AlignmentType.RIGHT,
                                    children: [
                                        new docx_1.TextRun({
                                            text: 'CMMS INDRA - Sistem Manajemen Pemeliharaan',
                                            italics: true,
                                            color: COLORS.gray,
                                            size: 16,
                                            font: 'Calibri',
                                        }),
                                    ],
                                }),
                            ],
                        }),
                    },
                    footers: {
                        default: new docx_1.Footer({
                            children: [
                                new docx_1.Paragraph({
                                    alignment: docx_1.AlignmentType.CENTER,
                                    border: {
                                        top: { style: docx_1.BorderStyle.SINGLE, size: 4, color: COLORS.border },
                                    },
                                    children: [
                                        new docx_1.TextRun({
                                            text: 'Halaman ',
                                            color: COLORS.gray,
                                            size: 16,
                                            font: 'Calibri',
                                        }),
                                        new docx_1.TextRun({
                                            children: [docx_1.PageNumber.CURRENT],
                                            color: COLORS.gray,
                                            size: 16,
                                            font: 'Calibri',
                                        }),
                                        new docx_1.TextRun({
                                            text: ' | Dicetak: ',
                                            color: COLORS.gray,
                                            size: 16,
                                            font: 'Calibri',
                                        }),
                                        new docx_1.TextRun({
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
                        new docx_1.Paragraph({
                            alignment: docx_1.AlignmentType.CENTER,
                            spacing: { after: 80 },
                            children: [
                                new docx_1.TextRun({
                                    text: 'LAPORAN WORK ORDER',
                                    bold: true,
                                    size: 32,
                                    color: COLORS.primary,
                                    font: 'Calibri',
                                }),
                            ],
                        }),
                        new docx_1.Paragraph({
                            alignment: docx_1.AlignmentType.CENTER,
                            spacing: { after: 40 },
                            children: [
                                new docx_1.TextRun({
                                    text: 'CMMS INDRA - Computerized Maintenance Management System',
                                    size: 20,
                                    color: COLORS.gray,
                                    font: 'Calibri',
                                }),
                            ],
                        }),
                        new docx_1.Paragraph({
                            alignment: docx_1.AlignmentType.CENTER,
                            spacing: { after: 200 },
                            children: [
                                new docx_1.TextRun({
                                    text: `Tanggal Cetak: ${reportDate}`,
                                    size: 18,
                                    color: COLORS.gray,
                                    font: 'Calibri',
                                }),
                            ],
                        }),
                        createSeparator(),
                        // === INFO BOX ===
                        new docx_1.Table({
                            width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
                            rows: [
                                new docx_1.TableRow({
                                    children: [
                                        new docx_1.TableCell({
                                            width: { size: 50, type: docx_1.WidthType.PERCENTAGE },
                                            shading: { type: docx_1.ShadingType.CLEAR, fill: 'eff6ff', color: 'auto' },
                                            children: [
                                                new docx_1.Paragraph({
                                                    spacing: { before: 80, after: 40 },
                                                    indent: { left: 120 },
                                                    children: [
                                                        new docx_1.TextRun({ text: 'Periode Laporan', bold: true, size: 18, color: COLORS.primary, font: 'Calibri' }),
                                                    ],
                                                }),
                                                new docx_1.Paragraph({
                                                    spacing: { after: 80 },
                                                    indent: { left: 120 },
                                                    children: [
                                                        new docx_1.TextRun({ text: filterDesc, size: 18, font: 'Calibri' }),
                                                    ],
                                                }),
                                            ],
                                        }),
                                        new docx_1.TableCell({
                                            width: { size: 50, type: docx_1.WidthType.PERCENTAGE },
                                            shading: { type: docx_1.ShadingType.CLEAR, fill: 'f0fdf4', color: 'auto' },
                                            children: [
                                                new docx_1.Paragraph({
                                                    spacing: { before: 80, after: 40 },
                                                    indent: { left: 120 },
                                                    children: [
                                                        new docx_1.TextRun({ text: 'Total Work Orders', bold: true, size: 18, color: COLORS.green, font: 'Calibri' }),
                                                    ],
                                                }),
                                                new docx_1.Paragraph({
                                                    spacing: { after: 80 },
                                                    indent: { left: 120 },
                                                    children: [
                                                        new docx_1.TextRun({ text: String(summary.totalWorkOrders), bold: true, size: 28, font: 'Calibri' }),
                                                    ],
                                                }),
                                            ],
                                        }),
                                    ],
                                }),
                            ],
                        }),
                        // === SUMMARY ===
                        new docx_1.Paragraph({
                            heading: docx_1.HeadingLevel.HEADING_2,
                            spacing: { before: 300, after: 150 },
                            children: [
                                new docx_1.TextRun({
                                    text: '1. Ringkasan Status',
                                    bold: true,
                                    size: 24,
                                    color: COLORS.primary,
                                    font: 'Calibri',
                                }),
                            ],
                        }),
                        new docx_1.Table({
                            width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
                            rows: [
                                new docx_1.TableRow({
                                    tableHeader: true,
                                    children: [
                                        createHeaderCell('Status'),
                                        createHeaderCell('Jumlah'),
                                        createHeaderCell('Persentase'),
                                    ],
                                }),
                                new docx_1.TableRow({
                                    children: [
                                        createCell('Open', { bold: true, color: COLORS.blue }),
                                        createCell(String(summary.openCount), { alignment: docx_1.AlignmentType.CENTER }),
                                        createCell(`${summary.totalWorkOrders > 0 ? Math.round((summary.openCount / summary.totalWorkOrders) * 100) : 0}%`, { alignment: docx_1.AlignmentType.CENTER }),
                                    ],
                                }),
                                new docx_1.TableRow({
                                    children: [
                                        createCell('Assigned', { bold: true, color: COLORS.orange }),
                                        createCell(String(summary.assignedCount), { shading: COLORS.lightBg, alignment: docx_1.AlignmentType.CENTER }),
                                        createCell(`${summary.totalWorkOrders > 0 ? Math.round((summary.assignedCount / summary.totalWorkOrders) * 100) : 0}%`, { shading: COLORS.lightBg, alignment: docx_1.AlignmentType.CENTER }),
                                    ],
                                }),
                                new docx_1.TableRow({
                                    children: [
                                        createCell('In Progress', { bold: true, color: COLORS.orange }),
                                        createCell(String(summary.inProgressCount), { alignment: docx_1.AlignmentType.CENTER }),
                                        createCell(`${summary.totalWorkOrders > 0 ? Math.round((summary.inProgressCount / summary.totalWorkOrders) * 100) : 0}%`, { alignment: docx_1.AlignmentType.CENTER }),
                                    ],
                                }),
                                new docx_1.TableRow({
                                    children: [
                                        createCell('On Hold', { bold: true, color: COLORS.red }),
                                        createCell(String(summary.onHoldCount), { shading: COLORS.lightBg, alignment: docx_1.AlignmentType.CENTER }),
                                        createCell(`${summary.totalWorkOrders > 0 ? Math.round((summary.onHoldCount / summary.totalWorkOrders) * 100) : 0}%`, { shading: COLORS.lightBg, alignment: docx_1.AlignmentType.CENTER }),
                                    ],
                                }),
                                new docx_1.TableRow({
                                    children: [
                                        createCell('Closed', { bold: true, color: COLORS.green }),
                                        createCell(String(summary.closedCount), { alignment: docx_1.AlignmentType.CENTER }),
                                        createCell(`${summary.totalWorkOrders > 0 ? Math.round((summary.closedCount / summary.totalWorkOrders) * 100) : 0}%`, { alignment: docx_1.AlignmentType.CENTER }),
                                    ],
                                }),
                                new docx_1.TableRow({
                                    children: [
                                        createCell('Total', { bold: true, shading: COLORS.lightBg }),
                                        createCell(String(summary.totalWorkOrders), { bold: true, shading: COLORS.lightBg, alignment: docx_1.AlignmentType.CENTER }),
                                        createCell('100%', { bold: true, shading: COLORS.lightBg, alignment: docx_1.AlignmentType.CENTER }),
                                    ],
                                }),
                            ],
                        }),
                        // === BREAKDOWN BY PRIORITY ===
                        new docx_1.Paragraph({
                            heading: docx_1.HeadingLevel.HEADING_2,
                            spacing: { before: 300, after: 150 },
                            children: [
                                new docx_1.TextRun({
                                    text: '2. Breakdown berdasarkan Prioritas',
                                    bold: true,
                                    size: 24,
                                    color: COLORS.primary,
                                    font: 'Calibri',
                                }),
                            ],
                        }),
                        new docx_1.Table({
                            width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
                            rows: [
                                new docx_1.TableRow({
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
                            new docx_1.Paragraph({
                                heading: docx_1.HeadingLevel.HEADING_2,
                                spacing: { before: 300, after: 150 },
                                children: [
                                    new docx_1.TextRun({
                                        text: '3. Breakdown berdasarkan Aset',
                                        bold: true,
                                        size: 24,
                                        color: COLORS.primary,
                                        font: 'Calibri',
                                    }),
                                ],
                            }),
                            new docx_1.Table({
                                width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
                                rows: [
                                    new docx_1.TableRow({
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
                        new docx_1.Paragraph({
                            heading: docx_1.HeadingLevel.HEADING_2,
                            spacing: { before: 300, after: 150 },
                            children: [
                                new docx_1.TextRun({
                                    text: '4. Detail Work Orders',
                                    bold: true,
                                    size: 24,
                                    color: COLORS.primary,
                                    font: 'Calibri',
                                }),
                            ],
                        }),
                        new docx_1.Paragraph({
                            spacing: { after: 100 },
                            children: [
                                new docx_1.TextRun({
                                    text: `Total: ${workOrders.length} Work Orders`,
                                    size: 18,
                                    color: COLORS.gray,
                                    font: 'Calibri',
                                }),
                            ],
                        }),
                        new docx_1.Table({
                            width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
                            rows: [
                                headerRow,
                                ...dataRows,
                            ],
                        }),
                        // === SIGNATURE SECTION ===
                        new docx_1.Paragraph({ spacing: { before: 500 }, children: [] }),
                        createSeparator(),
                        new docx_1.Paragraph({
                            heading: docx_1.HeadingLevel.HEADING_2,
                            spacing: { before: 200, after: 300 },
                            children: [
                                new docx_1.TextRun({
                                    text: 'Tanda Tangan',
                                    bold: true,
                                    size: 24,
                                    color: COLORS.primary,
                                    font: 'Calibri',
                                }),
                            ],
                        }),
                        new docx_1.Table({
                            width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
                            borders: {
                                top: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                bottom: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                left: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                right: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                insideHorizontal: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                insideVertical: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                            },
                            rows: [
                                new docx_1.TableRow({
                                    children: [
                                        new docx_1.TableCell({
                                            width: { size: 33, type: docx_1.WidthType.PERCENTAGE },
                                            borders: {
                                                top: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                                bottom: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                                left: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                                right: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                            },
                                            children: [
                                                new docx_1.Paragraph({
                                                    alignment: docx_1.AlignmentType.CENTER,
                                                    spacing: { after: 600 },
                                                    children: [
                                                        new docx_1.TextRun({ text: 'Disiapkan oleh:', size: 18, color: COLORS.gray, font: 'Calibri' }),
                                                    ],
                                                }),
                                                new docx_1.Paragraph({
                                                    alignment: docx_1.AlignmentType.CENTER,
                                                    spacing: { after: 40 },
                                                    children: [
                                                        new docx_1.TextRun({ text: '_________________________', size: 18, font: 'Calibri' }),
                                                    ],
                                                }),
                                                new docx_1.Paragraph({
                                                    alignment: docx_1.AlignmentType.CENTER,
                                                    spacing: { after: 40 },
                                                    children: [
                                                        new docx_1.TextRun({ text: 'Petugas Maintenance', bold: true, size: 18, font: 'Calibri' }),
                                                    ],
                                                }),
                                                new docx_1.Paragraph({
                                                    alignment: docx_1.AlignmentType.CENTER,
                                                    children: [
                                                        new docx_1.TextRun({ text: `Tanggal: ${reportDate}`, size: 16, color: COLORS.gray, font: 'Calibri' }),
                                                    ],
                                                }),
                                            ],
                                        }),
                                        new docx_1.TableCell({
                                            width: { size: 33, type: docx_1.WidthType.PERCENTAGE },
                                            borders: {
                                                top: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                                bottom: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                                left: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                                right: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                            },
                                            children: [
                                                new docx_1.Paragraph({
                                                    alignment: docx_1.AlignmentType.CENTER,
                                                    spacing: { after: 600 },
                                                    children: [
                                                        new docx_1.TextRun({ text: 'Diperiksa oleh:', size: 18, color: COLORS.gray, font: 'Calibri' }),
                                                    ],
                                                }),
                                                new docx_1.Paragraph({
                                                    alignment: docx_1.AlignmentType.CENTER,
                                                    spacing: { after: 40 },
                                                    children: [
                                                        new docx_1.TextRun({ text: '_________________________', size: 18, font: 'Calibri' }),
                                                    ],
                                                }),
                                                new docx_1.Paragraph({
                                                    alignment: docx_1.AlignmentType.CENTER,
                                                    spacing: { after: 40 },
                                                    children: [
                                                        new docx_1.TextRun({ text: 'Supervisor', bold: true, size: 18, font: 'Calibri' }),
                                                    ],
                                                }),
                                                new docx_1.Paragraph({
                                                    alignment: docx_1.AlignmentType.CENTER,
                                                    children: [
                                                        new docx_1.TextRun({ text: `Tanggal: ${reportDate}`, size: 16, color: COLORS.gray, font: 'Calibri' }),
                                                    ],
                                                }),
                                            ],
                                        }),
                                        new docx_1.TableCell({
                                            width: { size: 33, type: docx_1.WidthType.PERCENTAGE },
                                            borders: {
                                                top: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                                bottom: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                                left: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                                right: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                            },
                                            children: [
                                                new docx_1.Paragraph({
                                                    alignment: docx_1.AlignmentType.CENTER,
                                                    spacing: { after: 600 },
                                                    children: [
                                                        new docx_1.TextRun({ text: 'Disetujui oleh:', size: 18, color: COLORS.gray, font: 'Calibri' }),
                                                    ],
                                                }),
                                                new docx_1.Paragraph({
                                                    alignment: docx_1.AlignmentType.CENTER,
                                                    spacing: { after: 40 },
                                                    children: [
                                                        new docx_1.TextRun({ text: '_________________________', size: 18, font: 'Calibri' }),
                                                    ],
                                                }),
                                                new docx_1.Paragraph({
                                                    alignment: docx_1.AlignmentType.CENTER,
                                                    spacing: { after: 40 },
                                                    children: [
                                                        new docx_1.TextRun({ text: 'Manager / Plant Head', bold: true, size: 18, font: 'Calibri' }),
                                                    ],
                                                }),
                                                new docx_1.Paragraph({
                                                    alignment: docx_1.AlignmentType.CENTER,
                                                    children: [
                                                        new docx_1.TextRun({ text: `Tanggal: ${reportDate}`, size: 16, color: COLORS.gray, font: 'Calibri' }),
                                                    ],
                                                }),
                                            ],
                                        }),
                                    ],
                                }),
                            ],
                        }),
                        // === DISCLAIMER ===
                        new docx_1.Paragraph({ spacing: { before: 400 }, children: [] }),
                        new docx_1.Paragraph({
                            alignment: docx_1.AlignmentType.CENTER,
                            spacing: { before: 100 },
                            border: {
                                top: { style: docx_1.BorderStyle.SINGLE, size: 4, color: COLORS.border },
                            },
                            children: [
                                new docx_1.TextRun({
                                    text: 'Dokumen ini dihasilkan secara otomatis oleh CMMS INDRA.',
                                    italics: true,
                                    size: 16,
                                    color: COLORS.gray,
                                    font: 'Calibri',
                                }),
                            ],
                        }),
                        new docx_1.Paragraph({
                            alignment: docx_1.AlignmentType.CENTER,
                            children: [
                                new docx_1.TextRun({
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
        const buffer = await docx_1.Packer.toBuffer(doc);
        return buffer;
    }
    async generateSingleWorkOrderDocx(woId) {
        const db = await (0, connection_1.getDb)();
        const woResult = db.exec(`SELECT wo.*, a.assetName, a.assetCode, a.location as assetLocation,
        u1.name as reportedByName, u2.name as supervisorName, u3.name as assignedToName
       FROM work_orders wo
       LEFT JOIN assets a ON wo.assetId = a.id
       LEFT JOIN users u1 ON wo.reportedById = u1.id
       LEFT JOIN users u2 ON wo.supervisorId = u2.id
       LEFT JOIN users u3 ON wo.assignedToId = u3.id
       WHERE wo.id = ?`, [woId]);
        const wo = formatRow(woResult);
        if (!wo)
            throw new Error('Work Order not found');
        const histResult = db.exec(`SELECT h.*, u.name as changedByName FROM work_order_status_history h
       LEFT JOIN users u ON h.changedBy = u.id WHERE h.woId = ? ORDER BY h.createdAt ASC`, [woId]);
        const statusHistory = formatRows(histResult);
        const clResult = db.exec(`SELECT c.*, u.name as completedByName FROM work_order_checklists c
       LEFT JOIN users u ON c.completedBy = u.id WHERE c.woId = ? ORDER BY c.id`, [woId]);
        const checklists = formatRows(clResult);
        const spResult = db.exec(`SELECT wsp.*, sp.itemCode, sp.itemName FROM work_order_spare_parts wsp
       LEFT JOIN spare_parts sp ON wsp.itemId = sp.id WHERE wsp.woId = ?`, [woId]);
        const spareParts = formatRows(spResult);
        const now = new Date();
        const reportDate = now.toLocaleDateString('id-ID', {
            day: '2-digit', month: 'long', year: 'numeric',
        });
        const children = [];
        // HEADER
        children.push(new docx_1.Paragraph({
            alignment: docx_1.AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [
                new docx_1.TextRun({ text: 'WORK ORDER', bold: true, size: 32, color: COLORS.primary, font: 'Calibri' }),
            ],
        }), new docx_1.Paragraph({
            alignment: docx_1.AlignmentType.CENTER,
            spacing: { after: 40 },
            children: [
                new docx_1.TextRun({ text: 'CMMS INDRA - Computerized Maintenance Management System', size: 20, color: COLORS.gray, font: 'Calibri' }),
            ],
        }), new docx_1.Paragraph({
            alignment: docx_1.AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
                new docx_1.TextRun({ text: `Tanggal Cetak: ${reportDate}`, size: 18, color: COLORS.gray, font: 'Calibri' }),
            ],
        }), createSeparator());
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
            return new docx_1.TableRow({
                children: [
                    createCell(row[0], { bold: true, shading, width: 2000 }),
                    createCell(row[1], { shading, width: 3500 }),
                    createCell(row[2], { bold: true, shading, width: 2000 }),
                    createCell(row[3], { shading, width: 3500 }),
                ],
            });
        });
        children.push(new docx_1.Paragraph({
            heading: docx_1.HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 150 },
            children: [
                new docx_1.TextRun({ text: '1. Informasi Work Order', bold: true, size: 24, color: COLORS.primary, font: 'Calibri' }),
            ],
        }), new docx_1.Table({
            width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
            rows: infoTableRows,
        }));
        // PROBLEM DESCRIPTION
        if (wo.problemDescription) {
            children.push(new docx_1.Paragraph({
                heading: docx_1.HeadingLevel.HEADING_2,
                spacing: { before: 300, after: 150 },
                children: [
                    new docx_1.TextRun({ text: '2. Deskripsi Masalah', bold: true, size: 24, color: COLORS.primary, font: 'Calibri' }),
                ],
            }), new docx_1.Paragraph({
                spacing: { after: 100 },
                indent: { left: 200 },
                children: [
                    new docx_1.TextRun({ text: wo.problemDescription, size: 20, font: 'Calibri' }),
                ],
            }));
        }
        // WORK PERFORMED / ROOT CAUSE / RESOLUTION
        const detailSections = [
            { title: 'Pekerjaan yang Dilakukan', value: wo.workPerformed },
            { title: 'Akar Masalah (Root Cause)', value: wo.rootCause },
            { title: 'Resolusi / Tindakan Perbaikan', value: wo.resolution },
            { title: 'Catatan', value: wo.notes },
        ].filter(s => s.value);
        if (detailSections.length > 0) {
            children.push(new docx_1.Paragraph({
                heading: docx_1.HeadingLevel.HEADING_2,
                spacing: { before: 300, after: 150 },
                children: [
                    new docx_1.TextRun({ text: '3. Detail Pekerjaan', bold: true, size: 24, color: COLORS.primary, font: 'Calibri' }),
                ],
            }));
            for (const section of detailSections) {
                children.push(new docx_1.Paragraph({
                    spacing: { before: 100, after: 40 },
                    indent: { left: 200 },
                    children: [
                        new docx_1.TextRun({ text: `${section.title}:`, bold: true, size: 20, font: 'Calibri' }),
                    ],
                }), new docx_1.Paragraph({
                    spacing: { after: 100 },
                    indent: { left: 400 },
                    children: [
                        new docx_1.TextRun({ text: section.value, size: 20, font: 'Calibri' }),
                    ],
                }));
            }
        }
        // CHECKLISTS
        if (checklists.length > 0) {
            const clHeaderRow = new docx_1.TableRow({
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
            const clRows = checklists.map((cl, idx) => {
                const shading = idx % 2 === 0 ? COLORS.lightBg : undefined;
                return new docx_1.TableRow({
                    children: [
                        createCell(String(idx + 1), { shading, alignment: docx_1.AlignmentType.CENTER, width: 600 }),
                        createCell(cl.title || cl.description || '-', { shading, width: 4500 }),
                        createCell(cl.required ? 'Ya' : 'Tidak', { shading, width: 1000, alignment: docx_1.AlignmentType.CENTER }),
                        createCell(cl.completed ? 'Selesai' : 'Belum', {
                            bold: true,
                            color: cl.completed ? COLORS.green : COLORS.red,
                            shading,
                            width: 1200,
                            alignment: docx_1.AlignmentType.CENTER,
                        }),
                        createCell(cl.completedByName || '-', { shading, width: 2000 }),
                        createCell(formatDateTime(cl.completedAt), { shading, width: 1500 }),
                    ],
                });
            });
            children.push(new docx_1.Paragraph({
                heading: docx_1.HeadingLevel.HEADING_2,
                spacing: { before: 300, after: 150 },
                children: [
                    new docx_1.TextRun({ text: '4. Checklist Pekerjaan', bold: true, size: 24, color: COLORS.primary, font: 'Calibri' }),
                ],
            }), new docx_1.Table({
                width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
                rows: [clHeaderRow, ...clRows],
            }));
        }
        // SPARE PARTS
        if (spareParts.length > 0) {
            const spHeaderRow = new docx_1.TableRow({
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
            const spRows = spareParts.map((sp, idx) => {
                const shading = idx % 2 === 0 ? COLORS.lightBg : undefined;
                return new docx_1.TableRow({
                    children: [
                        createCell(String(idx + 1), { shading, alignment: docx_1.AlignmentType.CENTER, width: 600 }),
                        createCell(sp.itemCode || '-', { shading, width: 1500 }),
                        createCell(sp.itemName || '-', { shading, width: 2500 }),
                        createCell(String(sp.plannedQuantity || 0), { shading, width: 1500, alignment: docx_1.AlignmentType.CENTER }),
                        createCell(String(sp.usedQuantity || 0), { shading, width: 1500, alignment: docx_1.AlignmentType.CENTER }),
                        createCell(sp.unit || '-', { shading, width: 1000, alignment: docx_1.AlignmentType.CENTER }),
                        createCell(sp.unitCost ? `Rp ${Number(sp.unitCost).toLocaleString('id-ID')}` : '-', { shading, width: 1500, alignment: docx_1.AlignmentType.RIGHT }),
                        createCell(sp.totalCost ? `Rp ${Number(sp.totalCost).toLocaleString('id-ID')}` : '-', { shading, width: 1500, alignment: docx_1.AlignmentType.RIGHT }),
                    ],
                });
            });
            const totalCost = spareParts.reduce((sum, sp) => sum + (Number(sp.totalCost) || 0), 0);
            spRows.push(new docx_1.TableRow({
                children: [
                    createCell('', { shading: COLORS.lightBg, width: 600 }),
                    createCell('', { shading: COLORS.lightBg, width: 1500 }),
                    createCell('', { shading: COLORS.lightBg, width: 2500 }),
                    createCell('', { shading: COLORS.lightBg, width: 1500 }),
                    createCell('', { shading: COLORS.lightBg, width: 1500 }),
                    createCell('TOTAL', { bold: true, shading: COLORS.lightBg, width: 1000 }),
                    createCell('', { shading: COLORS.lightBg, width: 1500 }),
                    createCell(`Rp ${totalCost.toLocaleString('id-ID')}`, { bold: true, shading: COLORS.lightBg, width: 1500, alignment: docx_1.AlignmentType.RIGHT }),
                ],
            }));
            children.push(new docx_1.Paragraph({
                heading: docx_1.HeadingLevel.HEADING_2,
                spacing: { before: 300, after: 150 },
                children: [
                    new docx_1.TextRun({ text: '5. Spare Parts yang Digunakan', bold: true, size: 24, color: COLORS.primary, font: 'Calibri' }),
                ],
            }), new docx_1.Table({
                width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
                rows: [spHeaderRow, ...spRows],
            }));
        }
        // STATUS HISTORY
        if (statusHistory.length > 0) {
            const shHeaderRow = new docx_1.TableRow({
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
            const shRows = statusHistory.map((sh, idx) => {
                const shading = idx % 2 === 0 ? COLORS.lightBg : undefined;
                return new docx_1.TableRow({
                    children: [
                        createCell(String(idx + 1), { shading, alignment: docx_1.AlignmentType.CENTER, width: 600 }),
                        createCell(sh.fromStatus || '-', { shading, width: 2000 }),
                        createCell(sh.toStatus || '-', { bold: true, shading, width: 2000 }),
                        createCell(sh.changedByName || '-', { shading, width: 2500 }),
                        createCell(sh.notes || '-', { shading, width: 3000 }),
                        createCell(formatDateTime(sh.createdAt), { shading, width: 2000 }),
                    ],
                });
            });
            children.push(new docx_1.Paragraph({
                heading: docx_1.HeadingLevel.HEADING_2,
                spacing: { before: 300, after: 150 },
                children: [
                    new docx_1.TextRun({ text: '6. Riwayat Perubahan Status', bold: true, size: 24, color: COLORS.primary, font: 'Calibri' }),
                ],
            }), new docx_1.Table({
                width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
                rows: [shHeaderRow, ...shRows],
            }));
        }
        // SIGNATURE
        children.push(new docx_1.Paragraph({ spacing: { before: 500 }, children: [] }), createSeparator(), new docx_1.Paragraph({
            heading: docx_1.HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 300 },
            children: [
                new docx_1.TextRun({ text: 'Tanda Tangan', bold: true, size: 24, color: COLORS.primary, font: 'Calibri' }),
            ],
        }), new docx_1.Table({
            width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
            borders: {
                top: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                bottom: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                left: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                right: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                insideHorizontal: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                insideVertical: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            },
            rows: [
                new docx_1.TableRow({
                    children: [
                        new docx_1.TableCell({
                            width: { size: 33, type: docx_1.WidthType.PERCENTAGE },
                            borders: {
                                top: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                bottom: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                left: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                right: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                            },
                            children: [
                                new docx_1.Paragraph({ alignment: docx_1.AlignmentType.CENTER, spacing: { after: 600 }, children: [new docx_1.TextRun({ text: 'Dikerjakan oleh:', size: 18, color: COLORS.gray, font: 'Calibri' })] }),
                                new docx_1.Paragraph({ alignment: docx_1.AlignmentType.CENTER, spacing: { after: 40 }, children: [new docx_1.TextRun({ text: '_________________________', size: 18, font: 'Calibri' })] }),
                                new docx_1.Paragraph({ alignment: docx_1.AlignmentType.CENTER, spacing: { after: 40 }, children: [new docx_1.TextRun({ text: wo.assignedToName || 'Teknisi', bold: true, size: 18, font: 'Calibri' })] }),
                                new docx_1.Paragraph({ alignment: docx_1.AlignmentType.CENTER, children: [new docx_1.TextRun({ text: `Tanggal: ${reportDate}`, size: 16, color: COLORS.gray, font: 'Calibri' })] }),
                            ],
                        }),
                        new docx_1.TableCell({
                            width: { size: 33, type: docx_1.WidthType.PERCENTAGE },
                            borders: {
                                top: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                bottom: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                left: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                right: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                            },
                            children: [
                                new docx_1.Paragraph({ alignment: docx_1.AlignmentType.CENTER, spacing: { after: 600 }, children: [new docx_1.TextRun({ text: 'Diperiksa oleh:', size: 18, color: COLORS.gray, font: 'Calibri' })] }),
                                new docx_1.Paragraph({ alignment: docx_1.AlignmentType.CENTER, spacing: { after: 40 }, children: [new docx_1.TextRun({ text: '_________________________', size: 18, font: 'Calibri' })] }),
                                new docx_1.Paragraph({ alignment: docx_1.AlignmentType.CENTER, spacing: { after: 40 }, children: [new docx_1.TextRun({ text: wo.supervisorName || 'Supervisor', bold: true, size: 18, font: 'Calibri' })] }),
                                new docx_1.Paragraph({ alignment: docx_1.AlignmentType.CENTER, children: [new docx_1.TextRun({ text: `Tanggal: ${reportDate}`, size: 16, color: COLORS.gray, font: 'Calibri' })] }),
                            ],
                        }),
                        new docx_1.TableCell({
                            width: { size: 33, type: docx_1.WidthType.PERCENTAGE },
                            borders: {
                                top: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                bottom: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                left: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                                right: { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                            },
                            children: [
                                new docx_1.Paragraph({ alignment: docx_1.AlignmentType.CENTER, spacing: { after: 600 }, children: [new docx_1.TextRun({ text: 'Disetujui oleh:', size: 18, color: COLORS.gray, font: 'Calibri' })] }),
                                new docx_1.Paragraph({ alignment: docx_1.AlignmentType.CENTER, spacing: { after: 40 }, children: [new docx_1.TextRun({ text: '_________________________', size: 18, font: 'Calibri' })] }),
                                new docx_1.Paragraph({ alignment: docx_1.AlignmentType.CENTER, spacing: { after: 40 }, children: [new docx_1.TextRun({ text: 'Manager / Plant Head', bold: true, size: 18, font: 'Calibri' })] }),
                                new docx_1.Paragraph({ alignment: docx_1.AlignmentType.CENTER, children: [new docx_1.TextRun({ text: `Tanggal: ${reportDate}`, size: 16, color: COLORS.gray, font: 'Calibri' })] }),
                            ],
                        }),
                    ],
                }),
            ],
        }), new docx_1.Paragraph({ spacing: { before: 400 }, children: [] }), new docx_1.Paragraph({
            alignment: docx_1.AlignmentType.CENTER,
            spacing: { before: 100 },
            border: { top: { style: docx_1.BorderStyle.SINGLE, size: 4, color: COLORS.border } },
            children: [
                new docx_1.TextRun({ text: 'Dokumen ini dihasilkan secara otomatis oleh CMMS INDRA.', italics: true, size: 16, color: COLORS.gray, font: 'Calibri' }),
            ],
        }));
        const doc = new docx_1.Document({
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
                            size: { orientation: docx_1.PageOrientation.PORTRAIT },
                            margin: {
                                top: (0, docx_1.convertInchesToTwip)(0.8),
                                bottom: (0, docx_1.convertInchesToTwip)(0.8),
                                left: (0, docx_1.convertInchesToTwip)(0.8),
                                right: (0, docx_1.convertInchesToTwip)(0.8),
                            },
                        },
                    },
                    headers: {
                        default: new docx_1.Header({
                            children: [
                                new docx_1.Paragraph({
                                    alignment: docx_1.AlignmentType.RIGHT,
                                    children: [
                                        new docx_1.TextRun({ text: `WO: ${wo.woNumber}`, bold: true, italics: true, color: COLORS.primary, size: 16, font: 'Calibri' }),
                                        new docx_1.TextRun({ text: ' | CMMS INDRA', italics: true, color: COLORS.gray, size: 16, font: 'Calibri' }),
                                    ],
                                }),
                            ],
                        }),
                    },
                    footers: {
                        default: new docx_1.Footer({
                            children: [
                                new docx_1.Paragraph({
                                    alignment: docx_1.AlignmentType.CENTER,
                                    border: { top: { style: docx_1.BorderStyle.SINGLE, size: 4, color: COLORS.border } },
                                    children: [
                                        new docx_1.TextRun({ text: 'Halaman ', color: COLORS.gray, size: 16, font: 'Calibri' }),
                                        new docx_1.TextRun({ children: [docx_1.PageNumber.CURRENT], color: COLORS.gray, size: 16, font: 'Calibri' }),
                                        new docx_1.TextRun({ text: ` | Dicetak: ${formatDateTime(now.toISOString())}`, color: COLORS.gray, size: 16, font: 'Calibri' }),
                                    ],
                                }),
                            ],
                        }),
                    },
                    children,
                }],
        });
        const buffer = await docx_1.Packer.toBuffer(doc);
        return buffer;
    }
}
exports.WoExportService = WoExportService;
exports.woExportService = new WoExportService();
