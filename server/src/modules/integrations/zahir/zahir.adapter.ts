export interface IZahirAdapter {
  testConnection(): Promise<boolean>;
  syncInventoryItem(item: any): Promise<{ success: boolean; externalId?: string; error?: string }>;
  syncPurchaseRequisition(pr: any): Promise<{ success: boolean; externalId?: string; error?: string }>;
  syncFixedAsset(asset: any): Promise<{ success: boolean; externalId?: string; error?: string }>;
  sendStockAdjustment(transaction: any): Promise<{ success: boolean; externalId?: string; error?: string }>;
}

export class MockZahirAdapter implements IZahirAdapter {
  async testConnection(): Promise<boolean> {
    return true;
  }

  async syncInventoryItem(item: any): Promise<{ success: boolean; externalId?: string; error?: string }> {
    return { success: true, externalId: `MOCK-${item.itemCode}` };
  }

  async syncPurchaseRequisition(pr: any): Promise<{ success: boolean; externalId?: string; error?: string }> {
    return { success: true, externalId: `MOCK-PR-${pr.id}` };
  }

  async syncFixedAsset(asset: any): Promise<{ success: boolean; externalId?: string; error?: string }> {
    return { success: true, externalId: `MOCK-ASSET-${asset.id}` };
  }

  async sendStockAdjustment(transaction: any): Promise<{ success: boolean; externalId?: string; error?: string }> {
    return { success: true, externalId: `MOCK-TXN-${transaction.id}` };
  }
}

export class RealZahirAdapter implements IZahirAdapter {
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
    } catch {
      return false;
    }
  }

  async syncInventoryItem(item: any): Promise<{ success: boolean; externalId?: string; error?: string }> {
    try {
      const result = await this.request('POST', '/api/v1/inventory/items', item);
      return { success: true, externalId: result.data?.id };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async syncPurchaseRequisition(pr: any): Promise<{ success: boolean; externalId?: string; error?: string }> {
    try {
      const result = await this.request('POST', '/api/v1/purchasing/requisitions', pr);
      return { success: true, externalId: result.data?.id };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async syncFixedAsset(asset: any): Promise<{ success: boolean; externalId?: string; error?: string }> {
    try {
      const result = await this.request('POST', '/api/v1/fixed-assets', asset);
      return { success: true, externalId: result.data?.id };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async sendStockAdjustment(transaction: any): Promise<{ success: boolean; externalId?: string; error?: string }> {
    try {
      const result = await this.request('POST', '/api/v1/inventory/adjustments', transaction);
      return { success: true, externalId: result.data?.id };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
