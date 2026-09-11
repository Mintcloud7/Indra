"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XeroAdapter = void 0;
class XeroAdapter {
    provider = 'xero';
    baseUrl;
    accessToken;
    tenantId;
    constructor(baseUrl, accessToken, tenantId) {
        this.baseUrl = baseUrl || 'https://api.xero.com';
        this.accessToken = accessToken;
        this.tenantId = tenantId;
    }
    async request(method, path, body) {
        const res = await fetch(`${this.baseUrl}${path}`, {
            method,
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
                'Xero-Tenant-Id': this.tenantId
            },
            body: body ? JSON.stringify(body) : undefined
        });
        if (!res.ok)
            throw new Error(`Xero API error: ${res.status}`);
        return res.json();
    }
    async testConnection() {
        try {
            await this.request('GET', '/api.xro/2.0/Organisation');
            return true;
        }
        catch {
            return false;
        }
    }
    async syncInventoryItem(item) {
        try {
            const xeroItem = {
                ItemCode: item.itemCode || item.code,
                Name: item.name || item.itemName,
                IsTrackedAsInventory: true,
                InventoryAssetAccountCode: '1200',
                QuantityOnHand: item.currentStock || 0
            };
            const result = await this.request('PUT', '/api.xro/2.0/Items', { Items: [xeroItem] });
            return { success: true, externalId: result.Items?.[0]?.ItemID };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async syncPurchaseRequisition(pr) {
        try {
            const xeroBill = {
                Contact: { Name: pr.vendorName || 'Unknown' },
                LineItems: [{
                        Description: pr.reason || pr.description || '',
                        Quantity: pr.quantity || 1,
                        UnitAmount: pr.unitCost || 0,
                        AccountCode: '400'
                    }],
                Status: 'DRAFT'
            };
            const result = await this.request('PUT', '/api.xro/2.0/Invoices', { Invoices: [xeroBill] });
            return { success: true, externalId: result.Invoices?.[0]?.InvoiceID };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async syncFixedAsset(asset) {
        try {
            const xeroAsset = {
                Name: asset.name || asset.assetName,
                AssetNumber: asset.assetCode || asset.code,
                PurchaseDate: asset.purchaseDate || asset.installDate,
                PurchasePrice: asset.purchaseCost || 0,
                Status: 'ACTIVE'
            };
            const result = await this.request('PUT', '/api.xro/2.0/Assets', { Asset: xeroAsset });
            return { success: true, externalId: result.Assets?.[0]?.AssetID };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async sendStockAdjustment(txn) {
        try {
            const xeroManualJournal = {
                Narration: `Stock adjustment: ${txn.type} - ${txn.notes || ''}`,
                JournalLines: [{
                        LineAmount: (txn.quantity || 0) * (txn.unitCost || 0),
                        AccountCode: '1200',
                        IsDebit: txn.type === 'RECEIPT'
                    }]
            };
            const result = await this.request('PUT', '/api.xro/2.0/ManualJournals', { ManualJournals: [xeroManualJournal] });
            return { success: true, externalId: result.ManualJournals?.[0]?.ManualJournalID };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async syncWorkOrderClose(wo) {
        try {
            const xeroBill = {
                Contact: { Name: wo.vendorName || 'Maintenance' },
                LineItems: [{
                        Description: `WO Close: ${wo.woNumber || wo.title || ''}`,
                        Quantity: 1,
                        UnitAmount: wo.totalCost || 0,
                        AccountCode: '400'
                    }],
                Status: 'DRAFT'
            };
            const result = await this.request('PUT', '/api.xro/2.0/Invoices', { Invoices: [xeroBill] });
            return { success: true, externalId: result.Invoices?.[0]?.InvoiceID };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
}
exports.XeroAdapter = XeroAdapter;
