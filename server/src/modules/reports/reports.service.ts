import { getDb } from '../../database/connection';
import { paginate } from '../../shared/utils';

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

export class ReportsService {
  async workOrderReport(filters: any = {}): Promise<any> {
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
    const summary = formatRow(summaryResult);

    const byPriorityResult = db.exec(
      `SELECT wo.priority, COUNT(*) as count
       FROM work_orders wo ${where}
       GROUP BY wo.priority`,
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
      `SELECT wo.woNumber, wo.title, wo.priority, wo.status, wo.createdAt, wo.closedAt,
        a.assetName, a.assetCode,
        u.name as assignedToName
       FROM work_orders wo
       LEFT JOIN assets a ON wo.assetId = a.id
       LEFT JOIN users u ON wo.assignedToId = u.id
       ${where}
       ORDER BY wo.createdAt DESC`,
      params
    );
    const workOrders = formatRows(workOrdersResult);

    return {
      summary: summary || {
        totalWorkOrders: 0, openCount: 0, assignedCount: 0,
        inProgressCount: 0, onHoldCount: 0, closedCount: 0
      },
      byPriority,
      byAsset,
      workOrders
    };
  }

  async maintenanceCostReport(filters: any = {}): Promise<any> {
    const db = await getDb();
    let where = "WHERE wo.status = 'CLOSED'";
    const params: any[] = [];

    if (filters.startDate) { where += ` AND wo.closedAt >= ?`; params.push(filters.startDate); }
    if (filters.endDate) { where += ` AND wo.closedAt <= ?`; params.push(filters.endDate); }
    if (filters.assetId) { where += ` AND wo.assetId = ?`; params.push(filters.assetId); }

    const totalsResult = db.exec(
      `SELECT COALESCE(SUM(wsp.totalCost), 0) as "totalCost",
        COUNT(DISTINCT wo.id) as "woCount"
       FROM work_orders wo
       JOIN work_order_spare_parts wsp ON wsp.woId = wo.id
       ${where}`,
      params
    );
    const totals = formatRow(totalsResult);

    const byAssetResult = db.exec(
      `SELECT a.assetName, a.assetCode,
        COUNT(DISTINCT wo.id) as "woCount",
        COALESCE(SUM(wsp.totalCost), 0) as "totalCost"
       FROM work_orders wo
       JOIN work_order_spare_parts wsp ON wsp.woId = wo.id
       LEFT JOIN assets a ON wo.assetId = a.id
       ${where}
       GROUP BY wo.assetId, a.assetName, a.assetCode
       ORDER BY "totalCost" DESC`,
      params
    );
    const byAsset = formatRows(byAssetResult);

    const byMonthResult = db.exec(
      `SELECT strftime('%Y-%m', wo.closedAt) as month,
        COUNT(DISTINCT wo.id) as "woCount",
        COALESCE(SUM(wsp.totalCost), 0) as "totalCost"
       FROM work_orders wo
       JOIN work_order_spare_parts wsp ON wsp.woId = wo.id
       ${where}
       GROUP BY month
       ORDER BY month ASC`,
      params
    );
    const byMonth = formatRows(byMonthResult);

    const byItemResult = db.exec(
      `SELECT sp.itemCode, sp.itemName,
        SUM(wsp.usedQuantity) as "totalQuantity",
        COALESCE(SUM(wsp.totalCost), 0) as "totalCost"
       FROM work_orders wo
       JOIN work_order_spare_parts wsp ON wsp.woId = wo.id
       JOIN spare_parts sp ON wsp.itemId = sp.id
       ${where}
       GROUP BY sp.id, sp.itemCode, sp.itemName
       ORDER BY "totalCost" DESC`,
      params
    );
    const byItem = formatRows(byItemResult);

    const byWorkOrderResult = db.exec(
      `SELECT wo.id, wo.woNumber, wo.title, wo.closedAt,
        a.assetName, a.assetCode,
        u.name as assignedToName,
        COALESCE(SUM(wsp.totalCost), 0) as "totalCost",
        COUNT(wsp.id) as "sparePartCount"
       FROM work_orders wo
       JOIN work_order_spare_parts wsp ON wsp.woId = wo.id
       LEFT JOIN assets a ON wo.assetId = a.id
       LEFT JOIN users u ON wo.assignedToId = u.id
       ${where}
       GROUP BY wo.id, wo.woNumber, wo.title, wo.closedAt, a.assetName, a.assetCode, u.name
       ORDER BY "totalCost" DESC`,
      params
    );
    const byWorkOrder = formatRows(byWorkOrderResult);

    return {
      totalCost: totals?.totalCost || 0,
      woCount: totals?.woCount || 0,
      trend: byMonth.map((m: any) => ({ month: m.month, cost: m.totalCost })),
      byAsset,
      byMonth,
      byItem,
      byWorkOrder
    };
  }

  async sparePartUsageReport(filters: any = {}): Promise<any> {
    const db = await getDb();
    let where = 'WHERE wsp.usedQuantity > 0';
    const params: any[] = [];

    if (filters.startDate) { where += ` AND wo.closedAt >= ?`; params.push(filters.startDate); }
    if (filters.endDate) { where += ` AND wo.closedAt <= ?`; params.push(filters.endDate); }
    if (filters.itemId) { where += ` AND wsp.itemId = ?`; params.push(filters.itemId); }
    if (filters.assetId) { where += ` AND wo.assetId = ?`; params.push(filters.assetId); }

    const byItemResult = db.exec(
      `SELECT sp.itemCode, sp.itemName, sp.unit,
        COUNT(DISTINCT wsp.woId) as "woCount",
        SUM(wsp.usedQuantity) as "totalQuantity",
        COALESCE(SUM(wsp.totalCost), 0) as "totalCost"
       FROM work_order_spare_parts wsp
       JOIN spare_parts sp ON wsp.itemId = sp.id
       JOIN work_orders wo ON wsp.woId = wo.id
       ${where}
       GROUP BY sp.id, sp.itemCode, sp.itemName, sp.unit
       ORDER BY "totalQuantity" DESC`,
      params
    );
    const byItem = formatRows(byItemResult);

    const byAssetResult = db.exec(
      `SELECT a.assetName, a.assetCode,
        COUNT(DISTINCT wsp.woId) as "woCount",
        SUM(wsp.usedQuantity) as "totalQuantity",
        COALESCE(SUM(wsp.totalCost), 0) as "totalCost"
       FROM work_order_spare_parts wsp
       JOIN work_orders wo ON wsp.woId = wo.id
       LEFT JOIN assets a ON wo.assetId = a.id
       ${where}
       GROUP BY wo.assetId, a.assetName, a.assetCode
       ORDER BY "totalQuantity" DESC`,
      params
    );
    const byAsset = formatRows(byAssetResult);

    const byMonthResult = db.exec(
      `SELECT strftime('%Y-%m', wo.closedAt) as month,
        SUM(wsp.usedQuantity) as "totalQuantity",
        COALESCE(SUM(wsp.totalCost), 0) as "totalCost"
       FROM work_order_spare_parts wsp
       JOIN work_orders wo ON wsp.woId = wo.id
       ${where}
       GROUP BY month
       ORDER BY month ASC`,
      params
    );
    const byMonth = formatRows(byMonthResult);

    const totalsResult = db.exec(
      `SELECT SUM(wsp.usedQuantity) as "totalQuantity",
        COALESCE(SUM(wsp.totalCost), 0) as "totalCost"
       FROM work_order_spare_parts wsp
       JOIN work_orders wo ON wsp.woId = wo.id
       ${where}`,
      params
    );
    const totals = formatRow(totalsResult);

    return {
      totalQuantity: totals?.totalQuantity || 0,
      totalCost: totals?.totalCost || 0,
      data: byItem.map((r: any) => ({ name: r.itemName, quantity: r.totalQuantity })),
      byItem,
      byAsset,
      byMonth
    };
  }

  async mttr(filters: any = {}): Promise<any> {
    const db = await getDb();
    let where = "WHERE wo.status = 'CLOSED' AND wo.startedAt IS NOT NULL AND wo.closedAt IS NOT NULL";
    const params: any[] = [];

    if (filters.startDate) { where += ` AND wo.closedAt >= ?`; params.push(filters.startDate); }
    if (filters.endDate) { where += ` AND wo.closedAt <= ?`; params.push(filters.endDate); }
    if (filters.assetId) { where += ` AND wo.assetId = ?`; params.push(filters.assetId); }

    const overallResult = db.exec(
      `SELECT 
        COUNT(*) as count,
        AVG((julianday(wo.closedAt) - julianday(wo.startedAt)) * 24) as "avgHours"
       FROM work_orders wo ${where}`,
      params
    );
    const overall = formatRow(overallResult);

    const byAssetRowsResult = db.exec(
      `SELECT wo.assetId, a.assetName, a.assetCode,
        COUNT(*) as count,
        AVG((julianday(wo.closedAt) - julianday(wo.startedAt)) * 24) as "avgHours"
       FROM work_orders wo
       LEFT JOIN assets a ON wo.assetId = a.id
       ${where}
       GROUP BY wo.assetId, a.assetName, a.assetCode
       HAVING COUNT(*) >= 1
       ORDER BY "avgHours" ASC`,
      params
    );
    const byAssetRows = formatRows(byAssetRowsResult);

    const byAsset = byAssetRows.map((r: any) => ({
      ...r,
      avgHours: r.avgHours != null ? Math.round(r.avgHours * 10) / 10 : null,
      message: r.count < 3 ? 'Insufficient Data' : undefined
    }));

    const monthlyResult = db.exec(
      `SELECT strftime('%Y-%m', wo.closedAt) as month,
        AVG((julianday(wo.closedAt) - julianday(wo.startedAt)) * 24) as value
       FROM work_orders wo
       WHERE wo.status = 'CLOSED' AND wo.startedAt IS NOT NULL AND wo.closedAt IS NOT NULL
       ${filters.startDate ? 'AND wo.closedAt >= ?' : ''}
       ${filters.endDate ? 'AND wo.closedAt <= ?' : ''}
       ${filters.assetId ? 'AND wo.assetId = ?' : ''}
       GROUP BY month ORDER BY month ASC`,
      params
    );
    const monthlyTrend = formatRows(monthlyResult).map((r: any) => ({
      month: r.month,
      value: r.value != null ? Math.round(r.value * 10) / 10 : 0
    }));

    return {
      trend: monthlyTrend,
      current: overall?.avgHours != null ? Math.round(overall.avgHours * 10) / 10 : 0,
      overall: {
        count: overall?.count || 0,
        avgHours: overall?.avgHours != null ? Math.round(overall.avgHours * 10) / 10 : null,
        message: (overall?.count || 0) < 3 ? 'Insufficient Data' : undefined
      },
      byAsset
    };
  }

  async mtbf(filters: any = {}): Promise<any> {
    const db = await getDb();
    let where = "WHERE wo.status = 'CLOSED'";
    const params: any[] = [];

    if (filters.startDate) { where += ` AND wo.createdAt >= ?`; params.push(filters.startDate); }
    if (filters.endDate) { where += ` AND wo.createdAt <= ?`; params.push(filters.endDate); }
    if (filters.assetId) { where += ` AND wo.assetId = ?`; params.push(filters.assetId); }

    const assetRowsResult = db.exec(
      `SELECT assetId FROM work_orders wo ${where} GROUP BY assetId`,
      params
    );
    const assetRows = formatRows(assetRowsResult);

    const assetIds: string[] = assetRows.map((row: any) => row.assetId);

    const byAsset: any[] = [];

    for (const assetId of assetIds) {
      const woResult = db.exec(
        `SELECT wo.id, wo.createdAt
         FROM work_orders wo
         WHERE wo.assetId = ? AND wo.status = 'CLOSED'
         ORDER BY wo.createdAt ASC`,
        [assetId]
      );
      const woRows = formatRows(woResult);

      if (woRows.length < 2) continue;

      const assetInfoResult = db.exec('SELECT assetName, assetCode FROM assets WHERE id = ?', [assetId]);
      const assetInfo = formatRow(assetInfoResult);

      const timestamps: number[] = woRows.map((row: any) => new Date(row.createdAt).getTime());
      const gaps: number[] = [];
      for (let i = 1; i < timestamps.length; i++) {
        gaps.push(timestamps[i] - timestamps[i - 1]);
      }

      const avgGapHours = gaps.reduce((sum, g) => sum + g, 0) / gaps.length / (1000 * 60 * 60);

      byAsset.push({
        assetId,
        assetName: assetInfo?.assetName || null,
        assetCode: assetInfo?.assetCode || null,
        failureCount: woRows.length,
        avgHoursBetweenFailures: Math.round(avgGapHours * 10) / 10,
        message: woRows.length < 3 ? 'Insufficient Data' : undefined
      });
    }

    let overallCount = 0;
    let allGaps: number[] = [];

    for (const asset of byAsset) {
      if (asset.failureCount >= 3) {
        overallCount++;
        allGaps.push(asset.avgHoursBetweenFailures);
      }
    }

    const overallAvgHours = allGaps.length > 0
      ? Math.round((allGaps.reduce((s, g) => s + g, 0) / allGaps.length) * 10) / 10
      : null;

    // Compute monthly trend: for each asset, compute gaps and group by month of the later WO
    const monthlyGaps: Map<string, number[]> = new Map();
    for (const assetId of assetIds) {
      const woResult = db.exec(
        `SELECT wo.id, wo.assetId, wo.createdAt
         FROM work_orders wo
         WHERE wo.assetId = ? AND wo.status = 'CLOSED'
         ORDER BY wo.createdAt ASC`,
        [assetId]
      );
      const woRows = formatRows(woResult);
      if (woRows.length < 2) continue;
      for (let i = 1; i < woRows.length; i++) {
        const gap = (new Date(woRows[i].createdAt).getTime() - new Date(woRows[i - 1].createdAt).getTime()) / (1000 * 60 * 60);
        const month = woRows[i].createdAt.slice(0, 7);
        if (!monthlyGaps.has(month)) monthlyGaps.set(month, []);
        monthlyGaps.get(month)!.push(gap);
      }
    }
    const trend = Array.from(monthlyGaps.entries())
      .map(([month, gaps]) => ({ month, value: Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length * 10) / 10 }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      trend,
      current: overallAvgHours,
      overall: {
        avgHoursBetweenFailures: overallAvgHours,
        assetsWithEnoughData: overallCount,
        message: overallCount < 3 ? 'Insufficient Data' : undefined
      },
      byAsset
    };
  }

  async assetHistory(assetId: string): Promise<any> {
    const db = await getDb();
    const assetResult = db.exec('SELECT * FROM assets WHERE id = ?', [assetId]);
    const assetObj = formatRow(assetResult);
    if (!assetObj) {
      return null;
    }

    const workOrdersResult = db.exec(
      `SELECT wo.woNumber, wo.title, wo.priority, wo.status, wo.createdAt, wo.closedAt, wo.rootCause,
        u.name as assignedToName, r.name as reportedByName
       FROM work_orders wo
       LEFT JOIN users u ON wo.assignedToId = u.id
       LEFT JOIN users r ON wo.reportedById = r.id
       WHERE wo.assetId = ?
       ORDER BY wo.createdAt DESC`,
      [assetId]
    );
    const workOrders = formatRows(workOrdersResult);

    const pmResult = db.exec(
      `SELECT pm.title, pm.frequency, pm.nextDueDate, pm.status, pm.createdAt,
        u.name as assignedToName
       FROM preventive_maintenance pm
       LEFT JOIN users u ON pm.assignedToId = u.id
       WHERE pm.assetId = ?
       ORDER BY pm.createdAt DESC`,
      [assetId]
    );
    const preventiveMaintenance = formatRows(pmResult);

    const invResult = db.exec(
      `SELECT it.*, sp.itemCode, sp.itemName, w.name as warehouseName
       FROM inventory_transactions it
       JOIN spare_parts sp ON it.itemId = sp.id
       LEFT JOIN warehouses w ON it.warehouseId = w.id
       WHERE it.referenceType = 'WORK_ORDER' AND it.referenceId IN (
         SELECT id FROM work_orders WHERE assetId = ?
       )
       ORDER BY it.createdAt DESC`,
      [assetId]
    );
    const inventoryTransactions = formatRows(invResult);

    return {
      asset: assetObj,
      workOrders,
      preventiveMaintenance,
      inventoryTransactions
    };
  }
}

export const reportsService = new ReportsService();
