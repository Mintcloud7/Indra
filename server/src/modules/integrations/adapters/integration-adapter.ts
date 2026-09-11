export interface SyncResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

export interface IIntegrationAdapter {
  readonly provider: string;
  testConnection(): Promise<boolean>;
  syncInventoryItem(item: any): Promise<SyncResult>;
  syncPurchaseRequisition(pr: any): Promise<SyncResult>;
  syncFixedAsset(asset: any): Promise<SyncResult>;
  sendStockAdjustment(transaction: any): Promise<SyncResult>;
  syncWorkOrderClose(wo: any): Promise<SyncResult>;
}

export class MockAdapter implements IIntegrationAdapter {
  readonly provider: string;

  constructor(provider: string = 'mock') {
    this.provider = provider;
  }

  async testConnection(): Promise<boolean> { return true; }
  async syncInventoryItem(item: any): Promise<SyncResult> {
    return { success: true, externalId: `MOCK-${this.provider}-INV-${item.id || item.itemCode}` };
  }
  async syncPurchaseRequisition(pr: any): Promise<SyncResult> {
    return { success: true, externalId: `MOCK-${this.provider}-PR-${pr.id}` };
  }
  async syncFixedAsset(asset: any): Promise<SyncResult> {
    return { success: true, externalId: `MOCK-${this.provider}-ASSET-${asset.id}` };
  }
  async sendStockAdjustment(txn: any): Promise<SyncResult> {
    return { success: true, externalId: `MOCK-${this.provider}-TXN-${txn.id}` };
  }
  async syncWorkOrderClose(wo: any): Promise<SyncResult> {
    return { success: true, externalId: `MOCK-${this.provider}-WO-${wo.id}` };
  }
}

export class ZahirAdapter implements IIntegrationAdapter {
  readonly provider = 'zahir';
  private baseUrl: string;
  private apiKey: string;
  private companyId: string;

  constructor(baseUrl: string, apiKey: string, companyId: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.companyId = companyId;
  }

  private async request(method: string, path: string, body?: any): Promise<any> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'X-Company-ID': this.companyId
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw new Error(`Zahir API error: ${res.status}`);
    return res.json();
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.request('GET', '/api/health');
      return true;
    } catch { return false; }
  }

  async syncInventoryItem(item: any): Promise<SyncResult> {
    try {
      const result = await this.request('POST', '/api/v1/inventory/items', item);
      return { success: true, externalId: result.data?.id };
    } catch (err: any) { return { success: false, error: err.message }; }
  }

  async syncPurchaseRequisition(pr: any): Promise<SyncResult> {
    try {
      const result = await this.request('POST', '/api/v1/purchasing/requisitions', pr);
      return { success: true, externalId: result.data?.id };
    } catch (err: any) { return { success: false, error: err.message }; }
  }

  async syncFixedAsset(asset: any): Promise<SyncResult> {
    try {
      const result = await this.request('POST', '/api/v1/fixed-assets', asset);
      return { success: true, externalId: result.data?.id };
    } catch (err: any) { return { success: false, error: err.message }; }
  }

  async sendStockAdjustment(txn: any): Promise<SyncResult> {
    try {
      const result = await this.request('POST', '/api/v1/inventory/adjustments', txn);
      return { success: true, externalId: result.data?.id };
    } catch (err: any) { return { success: false, error: err.message }; }
  }

  async syncWorkOrderClose(wo: any): Promise<SyncResult> {
    try {
      const result = await this.request('POST', '/api/v1/work-orders/close', wo);
      return { success: true, externalId: result.data?.id };
    } catch (err: any) { return { success: false, error: err.message }; }
  }
}
