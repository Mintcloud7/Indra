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

export class DashboardService {
  async getKpi(): Promise<any> {
    const db = await getDb();

    const openResult = db.exec("SELECT COUNT(*) as c FROM work_orders WHERE status = 'OPEN'");
    const openWO = (openResult[0]?.values[0]?.[0] as number) || 0;

    const inProgressResult = db.exec("SELECT COUNT(*) as c FROM work_orders WHERE status = 'IN_PROGRESS'");
    const inProgressWO = (inProgressResult[0]?.values[0]?.[0] as number) || 0;

    const onHoldResult = db.exec("SELECT COUNT(*) as c FROM work_orders WHERE status = 'ON_HOLD'");
    const onHoldWO = (onHoldResult[0]?.values[0]?.[0] as number) || 0;

    const closedResult = db.exec("SELECT COUNT(*) as c FROM work_orders WHERE status = 'CLOSED'");
    const closedWO = (closedResult[0]?.values[0]?.[0] as number) || 0;

    const today = new Date().toISOString().split('T')[0];
    const pmDueResult = db.exec(
      "SELECT COUNT(*) as c FROM preventive_maintenance WHERE status = 'ACTIVE' AND nextDueDate <= ? AND nextDueDate >= ?",
      [today, today]
    );
    const pmDue = (pmDueResult[0]?.values[0]?.[0] as number) || 0;

    const pmOverdueResult = db.exec(
      "SELECT COUNT(*) as c FROM preventive_maintenance WHERE status = 'ACTIVE' AND nextDueDate < ?",
      [today]
    );
    const pmOverdue = (pmOverdueResult[0]?.values[0]?.[0] as number) || 0;

    const lowStockResult = db.exec(
      "SELECT COUNT(*) as c FROM spare_parts WHERE currentStock <= minimumStock AND minimumStock > 0"
    );
    const lowStock = (lowStockResult[0]?.values[0]?.[0] as number) || 0;

    const costResult = db.exec(
      `SELECT COALESCE(SUM(totalCost), 0) as c FROM work_order_spare_parts wsp
       JOIN work_orders wo ON wsp.woId = wo.id
       WHERE wo.status = 'CLOSED'`
    );
    const maintenanceCost = (costResult[0]?.values[0]?.[0] as number) || 0;

    const downtimeResult = db.exec(
      `SELECT AVG((julianday(closedAt) - julianday(startedAt)) * 24) as c
       FROM work_orders
       WHERE status = 'CLOSED' AND startedAt IS NOT NULL AND closedAt IS NOT NULL`
    );
    const downtimeVal = downtimeResult[0]?.values[0]?.[0];

    const mtbfResult = db.exec(
      `SELECT AVG(datediff_hours) as c FROM (
        SELECT AVG((julianday(wo2.createdAt) - julianday(wo1.createdAt)) * 24) as datediff_hours
        FROM work_orders wo1
        JOIN work_orders wo2 ON wo1.assetId = wo2.assetId AND wo2.createdAt > wo1.createdAt
        WHERE wo1.status = 'CLOSED' AND wo2.status = 'CLOSED'
        GROUP BY wo1.assetId, wo1.id
      ) sub`
    );
    const mtbfVal = mtbfResult[0]?.values[0]?.[0];

    return {
      openWO,
      inProgressWO,
      onHoldWO,
      closedWO,
      pmDue,
      pmOverdue,
      lowStock,
      maintenanceCost,
      downtime: downtimeVal ? Math.round(downtimeVal * 10) / 10 : null,
      mtbf: mtbfVal ? Math.round(mtbfVal * 10) / 10 : null
    };
  }

  async getCharts(): Promise<any> {
    const db = await getDb();

    const woByStatusResult = db.exec("SELECT status, COUNT(*) as count FROM work_orders GROUP BY status");
    const woByStatus = formatRows(woByStatusResult);

    const woByPriorityResult = db.exec("SELECT priority, COUNT(*) as count FROM work_orders GROUP BY priority");
    const woByPriority = formatRows(woByPriorityResult);

    const maintenanceTrendResult = db.exec(
      `SELECT strftime('%Y-%m', createdAt) as month, COUNT(*) as count
       FROM work_orders WHERE createdAt >= date('now', '-12 months')
       GROUP BY month ORDER BY month`
    );
    const maintenanceTrend = formatRows(maintenanceTrendResult);

    const sparePartUsageResult = db.exec(
      `SELECT sp.itemName, SUM(wsp.usedQuantity) as "totalUsed", SUM(wsp.totalCost) as "totalCost"
       FROM work_order_spare_parts wsp
       JOIN spare_parts sp ON wsp.itemId = sp.id
       WHERE wsp.usedQuantity > 0
       GROUP BY sp.id, sp.itemName ORDER BY "totalUsed" DESC LIMIT 5`
    );
    const sparePartUsage = formatRows(sparePartUsageResult);

    const maintenanceCostTrendResult = db.exec(
      `SELECT strftime('%Y-%m', wo.closedAt) as month, SUM(wsp.totalCost) as cost
       FROM work_order_spare_parts wsp
       JOIN work_orders wo ON wsp.woId = wo.id
       WHERE wo.status = 'CLOSED' AND wo.closedAt >= date('now', '-12 months')
       GROUP BY month ORDER BY month`
    );
    const maintenanceCostTrend = formatRows(maintenanceCostTrendResult);

    const assetFailureTrendResult = db.exec(
      `SELECT a.assetName, strftime('%Y-%m', wo.createdAt) as month, COUNT(*) as failures
       FROM work_orders wo
       JOIN assets a ON wo.assetId = a.id
       WHERE wo.status = 'CLOSED' AND wo.createdAt >= date('now', '-12 months')
       GROUP BY a.assetName, month ORDER BY month`
    );
    const assetFailureTrend = formatRows(assetFailureTrendResult);

    return {
      woByStatus,
      woByPriority,
      maintenanceTrend,
      sparePartUsage,
      maintenanceCostTrend,
      assetFailureTrend
    };
  }

  async getRecentWorkOrders(): Promise<any[]> {
    const db = await getDb();
    const result = db.exec(
      `SELECT wo.id, wo.woNumber, wo.title, wo.priority, wo.status, wo.createdAt, u.name as assignedToName
       FROM work_orders wo LEFT JOIN users u ON wo.assignedToId = u.id
       ORDER BY wo.createdAt DESC LIMIT 5`
    );
    return formatRows(result);
  }

  async getUpcomingPM(): Promise<any[]> {
    const db = await getDb();
    const today = new Date().toISOString().split('T')[0];
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const result = db.exec(
      `SELECT pm.id, pm.title, pm.frequency, pm.nextDueDate, a.assetName, a.assetCode
       FROM preventive_maintenance pm
       JOIN assets a ON pm.assetId = a.id
       WHERE pm.status = 'ACTIVE' AND pm.nextDueDate >= ? AND pm.nextDueDate <= ?
       ORDER BY pm.nextDueDate ASC LIMIT 5`,
      [today, nextMonth]
    );
    return formatRows(result);
  }

  async getLowStockItems(): Promise<any[]> {
    const db = await getDb();
    const result = db.exec(
      `SELECT id, itemCode, itemName, currentStock, minimumStock, unit
       FROM spare_parts WHERE currentStock <= minimumStock AND minimumStock > 0
       ORDER BY (currentStock / minimumStock) ASC LIMIT 5`
    );
    return formatRows(result);
  }

  async getFullDashboard(): Promise<any> {
    const [kpi, charts, recentWO, upcomingPM, lowStock] = await Promise.all([
      this.getKpi(),
      this.getCharts(),
      this.getRecentWorkOrders(),
      this.getUpcomingPM(),
      this.getLowStockItems()
    ]);
    return { kpi, ...charts, recentWorkOrders: recentWO, upcomingPM, lowStockItems: lowStock };
  }
}

export const dashboardService = new DashboardService();
