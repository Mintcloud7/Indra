"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealZahirAdapter = exports.MockZahirAdapter = void 0;
class MockZahirAdapter {
    async testConnection() {
        return true;
    }
    async syncInventoryItem(item) {
        return { success: true, externalId: `MOCK-${item.itemCode}` };
    }
    async syncPurchaseRequisition(pr) {
        return { success: true, externalId: `MOCK-PR-${pr.id}` };
    }
    async syncFixedAsset(asset) {
        return { success: true, externalId: `MOCK-ASSET-${asset.id}` };
    }
    async sendStockAdjustment(transaction) {
        return { success: true, externalId: `MOCK-TXN-${transaction.id}` };
    }
}
exports.MockZahirAdapter = MockZahirAdapter;
class RealZahirAdapter {
    baseUrl;
    apiKey;
    companyId;
    constructor(baseUrl, apiKey, companyId) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
        this.companyId = companyId;
    }
    async request(method, path, body) {
        const res = await fetch(`${this.baseUrl}${path}`, {
            method,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'X-Company-ID': this.companyId
            },
            body: body ? JSON.stringify(body) : undefined
        });
        if (!res.ok)
            throw new Error(`Zahir API error: ${res.status}`);
        return res.json();
    }
    async testConnection() {
        try {
            await this.request('GET', '/api/health');
            return true;
        }
        catch {
            return false;
        }
    }
    async syncInventoryItem(item) {
        try {
            const result = await this.request('POST', '/api/v1/inventory/items', item);
            return { success: true, externalId: result.data?.id };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async syncPurchaseRequisition(pr) {
        try {
            const result = await this.request('POST', '/api/v1/purchasing/requisitions', pr);
            return { success: true, externalId: result.data?.id };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async syncFixedAsset(asset) {
        try {
            const result = await this.request('POST', '/api/v1/fixed-assets', asset);
            return { success: true, externalId: result.data?.id };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async sendStockAdjustment(transaction) {
        try {
            const result = await this.request('POST', '/api/v1/inventory/adjustments', transaction);
            return { success: true, externalId: result.data?.id };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
}
exports.RealZahirAdapter = RealZahirAdapter;
