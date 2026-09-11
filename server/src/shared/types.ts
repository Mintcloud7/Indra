import { Request } from 'express';

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  phone?: string;
  avatar?: string;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Permission {
  id: string;
  name: string;
  module: string;
  action: string;
  description?: string;
  createdAt: string;
}

export interface Asset {
  id: string;
  assetCode: string;
  assetName: string;
  assetType: string;
  location: string;
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
  purchaseDate?: string;
  warrantyStart?: string;
  warrantyEnd?: string;
  status: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetDocument {
  id: string;
  assetId: string;
  filename: string;
  type: string;
  path: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
}

export interface AssetMeter {
  id: string;
  assetId: string;
  meterType: string;
  unit: string;
  description?: string;
  createdAt: string;
}

export interface AssetMeterReading {
  id: string;
  meterId: string;
  assetId: string;
  value: number;
  readingDate: string;
  recordedBy: string;
}

export interface WorkOrder {
  id: string;
  woNumber: string;
  title: string;
  description?: string;
  assetId?: string;
  location?: string;
  reportedById: string;
  supervisorId?: string;
  assignedToId?: string;
  priority: string;
  status: string;
  dueDate?: string;
  createdAt: string;
  assignedAt?: string;
  startedAt?: string;
  completedAt?: string;
  closedAt?: string;
  problemDescription?: string;
  repairInstruction?: string;
  workPerformed?: string;
  rootCause?: string;
  resolution?: string;
  notes?: string;
}

export interface WorkOrderStatusHistory {
  id: string;
  woId: string;
  fromStatus?: string;
  toStatus: string;
  changedBy: string;
  notes?: string;
  createdAt: string;
}

export interface WorkOrderChecklist {
  id: string;
  woId: string;
  title: string;
  description?: string;
  required: number;
  completed: number;
  completedBy?: string;
  completedAt?: string;
  notes?: string;
}

export interface WorkOrderAttachment {
  id: string;
  woId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  path: string;
  size: number;
  uploadedBy: string;
  createdAt: string;
}

export interface WorkOrderSparePart {
  id: string;
  woId: string;
  itemId: string;
  plannedQuantity?: number;
  usedQuantity?: number;
  unit?: string;
  unitCost: number;
  totalCost: number;
  createdAt: string;
}

export interface PreventiveMaintenance {
  id: string;
  assetId: string;
  title: string;
  description?: string;
  frequency: string;
  customIntervalDays?: number;
  startDate: string;
  nextDueDate: string;
  meterType?: string;
  meterThreshold?: number;
  assignedToId?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PreventiveMaintenanceChecklist {
  id: string;
  pmId: string;
  title: string;
  description?: string;
  required: number;
  createdAt: string;
}

export interface PreventiveMaintenanceLog {
  id: string;
  pmId: string;
  woId?: string;
  completedAt: string;
  notes?: string;
}

export interface SparePart {
  id: string;
  itemCode: string;
  itemName: string;
  category?: string;
  specification?: string;
  unit: string;
  warehouseId?: string;
  stockLocation?: string;
  currentStock: number;
  minimumStock: number;
  maximumStock: number;
  unitCost: number;
  zahirItemId?: string;
  lastSync?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Warehouse {
  id: string;
  name: string;
  location?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryTransaction {
  id: string;
  itemId: string;
  warehouseId: string;
  transactionType: string;
  quantity: number;
  unitCost: number;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  referenceType?: string;
  referenceId?: string;
  read: number;
  createdAt: string;
}

export interface PurchaseRequisition {
  id: string;
  itemId: string;
  quantity: number;
  unit?: string;
  reason?: string;
  currentStock?: number;
  minimumStock?: number;
  status: string;
  externalPrId?: string;
  syncStatus?: string;
  syncError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationConfig {
  id: string;
  key: string;
  value?: string;
  encrypted: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationJob {
  id: string;
  type: string;
  referenceType?: string;
  referenceId?: string;
  payload: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: string;
  lastError?: string;
  idempotencyKey?: string;
  createdAt: string;
  processedAt?: string;
}

export interface IntegrationLog {
  id: string;
  type: string;
  endpoint?: string;
  requestId?: string;
  referenceType?: string;
  referenceId?: string;
  status: string;
  responseStatus?: number;
  responseMessage?: string;
  duration?: number;
  createdAt: string;
}

export interface WebhookEvent {
  id: string;
  externalEventId?: string;
  source: string;
  eventType: string;
  payload: string;
  status: string;
  processedAt?: string;
  error?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface DashboardKpi {
  totalAssets: number;
  activeAssets: number;
  totalWorkOrders: number;
  openWorkOrders: number;
  overdueWorkOrders: number;
  pendingPm: number;
  lowStockItems: number;
  pendingPr: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    roles: string[];
    permissions: string[];
  };
}
