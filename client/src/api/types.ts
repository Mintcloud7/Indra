export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  phone?: string;
  avatar?: string;
  isActive: boolean;
  roles: string[];
  permissions: string[];
}

export interface Role {
  id: number;
  name: string;
  permissions: string[];
}

export interface Asset {
  id: string;
  assetCode: string;
  assetName: string;
  description: string;
  assetType: string;
  location: string;
  status: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  purchaseDate: string;
  warrantyStart: string;
  warrantyEnd: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkOrder {
  id: number;
  woNumber: string;
  title: string;
  description: string;
  assetId: number;
  asset?: Asset;
  status: string;
  priority: string;
  assignedTo: number | null;
  assignedUser?: User;
  dueDate: string;
  startedAt: string | null;
  completedAt: string | null;
  problemDescription: string;
  rootCause: string;
  actionTaken: string;
  createdBy: number;
  createdByUser?: User;
  createdAt: string;
  updatedAt: string;
}

export interface PreventiveMaintenance {
  id: string;
  title: string;
  assetId: string;
  asset?: Asset;
  assetName?: string;
  assetCode?: string;
  frequency: string;
  frequencyValue: number;
  nextDueDate: string;
  lastCompletedDate: string | null;
  assignedTo: string | null;
  assignedToName?: string;
  assignedUser?: User;
  status: string;
  description: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SparePart {
  id: string;
  itemCode: string;
  itemName: string;
  category: string;
  specification: string;
  unit: string;
  warehouseId: string;
  warehouseName: string;
  stockLocation: string;
  currentStock: number;
  minimumStock: number;
  maximumStock: number;
  unitCost: number;
  createdAt: string;
  updatedAt: string;
}

export interface Warehouse {
  id: string;
  name: string;
  location: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryTransaction {
  id: number;
  sparePartId: number;
  sparePart?: SparePart;
  type: string;
  quantity: number;
  unitCost: number;
  reference: string;
  notes: string;
  createdBy: number;
  createdByUser?: User;
  createdAt: string;
}

export interface ChecklistItem {
  id: number;
  workOrderId: number;
  description: string;
  isCompleted: boolean;
  completedAt: string | null;
  completedBy: number | null;
  createdAt: string;
}

export interface Attachment {
  id: number;
  workOrderId: number;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: number;
  uploadedByUser?: User;
  createdAt: string;
}

export interface MaintenanceHistory {
  id: number;
  workOrderId: number;
  workOrder?: WorkOrder;
  oldStatus: string;
  newStatus: string;
  changedBy: number;
  changedByUser?: User;
  notes: string;
  createdAt: string;
}

export interface AuditLog {
  id: number;
  userId: number;
  user?: User;
  action: string;
  entity: string;
  entityId: number;
  oldValues: Record<string, any>;
  newValues: Record<string, any>;
  ipAddress: string;
  createdAt: string;
}

export interface IntegrationLog {
  id: string;
  type: string;
  provider: string;
  status: string;
  error: string;
  responseMessage: string;
  createdAt: string;
}

export interface FailedJob {
  id: string;
  type: string;
  provider: string;
  payload: Record<string, any>;
  lastError: string;
  error: string;
  status: string;
  createdAt: string;
  failedAt: string;
}

export interface IntegrationProvider {
  id: string;
  name: string;
  description: string;
}

export interface DashboardData {
  kpi: {
    openWO: number;
    inProgressWO: number;
    onHoldWO: number;
    closedWO: number;
    pmDue: number;
    pmOverdue: number;
    lowStock: number;
    maintenanceCost: number;
    downtime: number;
    mtbf: number;
  };
  woByStatus: { name: string; value: number }[];
  woByPriority: { name: string; value: number }[];
  maintenanceTrend: { month: string; count: number }[];
  sparePartUsage: { name: string; quantity: number }[];
  maintenanceCostTrend: { month: string; cost: number }[];
  recentWorkOrders: WorkOrder[];
  upcomingPM: PreventiveMaintenance[];
  lowStockItems: SparePart[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  link: string | null;
  referenceType?: string;
  referenceId?: string;
  createdAt: string;
}

export interface LogBookItem {
  id: string;
  logBookId: string;
  description: string;
  activityType: string;
  location: string;
  assetId: string;
  workOrderNo: string;
  durationMinutes: number;
  status: string;
  notes: string;
  createdAt: string;
}

export interface LogBookSparePart {
  id: string;
  logBookId: string;
  logBookItemId: string;
  sparePartId: string;
  quantity: number;
  unitCost: number;
  notes: string;
  itemCode: string;
  itemName: string;
  unit: string;
}

export interface LogBook {
  id: string;
  userId: string;
  userName: string;
  workDate: string;
  location: string;
  description: string;
  status: string;
  items: LogBookItem[];
  spareParts: LogBookSparePart[];
  createdAt: string;
  updatedAt: string;
}
