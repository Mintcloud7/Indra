import { IIntegrationAdapter, SyncResult } from './integration-adapter';

export class QuickBooksAdapter implements IIntegrationAdapter {
  readonly provider = 'quickbooks';
  private baseUrl: string;
  private accessToken: string;
  private realmId: string;

  constructor(baseUrl: string, accessToken: string, realmId: string) {
    this.baseUrl = baseUrl || 'https://quickbooks.api.intuit.com';
    this.accessToken = accessToken;
    this.realmId = realmId;
  }

  private async request(method: string, path: string, body?: any): Promise<any> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw new Error(`QuickBooks API error: ${res.status}`);
    return res.json();
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.request('GET', `/v3/company/${this.realmId}/companyinfo/${this.realmId}`);
      return true;
    } catch { return false; }
  }

  async syncInventoryItem(item: any): Promise<SyncResult> {
    try {
      const qbItem = {
        Name: item.name || item.itemName,
        Type: 'Inventory',
        QtyOnHand: item.currentStock,
        InvStartDate: new Date().toISOString().split('T')[0],
        UnitPrice: item.unitCost || 0
      };
      const result = await this.request('POST', `/v3/company/${this.realmId}/item`, qbItem);
      return { success: true, externalId: result.Item?.Id };
    } catch (err: any) { return { success: false, error: err.message }; }
  }

  async syncPurchaseRequisition(pr: any): Promise<SyncResult> {
    try {
      const qbBill = {
        VendorRef: { name: pr.vendorName || 'Unknown' },
        Line: [{
          DetailType: 'AccountBasedExpenseLineDetail',
          Amount: (pr.quantity || 0) * (pr.unitCost || 0),
          Description: pr.reason || pr.description || ''
        }]
      };
      const result = await this.request('POST', `/v3/company/${this.realmId}/bill`, qbBill);
      return { success: true, externalId: result.Bill?.Id };
    } catch (err: any) { return { success: false, error: err.message }; }
  }

  async syncFixedAsset(asset: any): Promise<SyncResult> {
    try {
      const qbItem = {
        Name: asset.name || asset.assetName,
        Type: 'FixedAsset',
        QtyOnHand: 1,
        PurchaseDate: asset.purchaseDate || asset.installDate,
        UnitPrice: asset.purchaseCost || 0
      };
      const result = await this.request('POST', `/v3/company/${this.realmId}/item`, qbItem);
      return { success: true, externalId: result.Item?.Id };
    } catch (err: any) { return { success: false, error: err.message }; }
  }

  async sendStockAdjustment(txn: any): Promise<SyncResult> {
    try {
      const qbJournalEntry = {
        Line: [{
          DetailType: 'JournalEntryLineDetail',
          Amount: (txn.quantity || 0) * (txn.unitCost || 0),
          JournalEntryLineDetail: {
            PostingType: txn.type === 'RECEIPT' ? 'Debit' : 'Credit'
          }
        }]
      };
      const result = await this.request('POST', `/v3/company/${this.realmId}/journalentry`, qbJournalEntry);
      return { success: true, externalId: result.JournalEntry?.Id };
    } catch (err: any) { return { success: false, error: err.message }; }
  }

  async syncWorkOrderClose(wo: any): Promise<SyncResult> {
    try {
      const qbBill = {
        VendorRef: { name: wo.vendorName || 'Maintenance' },
        Line: [{
          DetailType: 'AccountBasedExpenseLineDetail',
          Amount: wo.totalCost || 0,
          Description: `WO Close: ${wo.woNumber || wo.title || ''}`
        }]
      };
      const result = await this.request('POST', `/v3/company/${this.realmId}/bill`, qbBill);
      return { success: true, externalId: result.Bill?.Id };
    } catch (err: any) { return { success: false, error: err.message }; }
  }
}
