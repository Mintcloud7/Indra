"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adapterRegistry = exports.SUPPORTED_PROVIDERS = void 0;
const integration_adapter_1 = require("./integration-adapter");
const quickbooks_adapter_1 = require("./quickbooks.adapter");
const xero_adapter_1 = require("./xero.adapter");
const connection_1 = require("../../../database/connection");
function formatRow(result, index = 0) {
    if (!result[0] || !result[0].values[index])
        return null;
    const obj = {};
    result[0].columns.forEach((col, i) => {
        obj[col] = result[0].values[index][i];
    });
    return obj;
}
exports.SUPPORTED_PROVIDERS = [
    { id: 'zahir', name: 'Zahir Accounting', description: 'Indonesian SaaS accounting software' },
    { id: 'quickbooks', name: 'QuickBooks', description: 'Intuit QuickBooks Online' },
    { id: 'xero', name: 'Xero', description: 'Xero cloud accounting' },
];
class AdapterRegistry {
    adapters = new Map();
    async getConfig(provider) {
        const db = await (0, connection_1.getDb)();
        const prefix = `${provider}_`;
        const result = db.exec("SELECT key, value FROM integration_configs WHERE key LIKE ?", [`${prefix}%`]);
        const config = { provider };
        if (result[0]) {
            for (const row of result[0].values) {
                const key = row[0];
                const val = row[1];
                const field = key.replace(prefix, '');
                if (field === 'use_mock')
                    config.useMock = val === 'true';
                else if (field === 'api_url')
                    config.apiUrl = val;
                else if (field === 'api_key')
                    config.apiKey = val;
                else if (field === 'company_id')
                    config.companyId = val;
                else if (field === 'tenant_id')
                    config.tenantId = val;
                else if (field === 'realm_id')
                    config.realmId = val;
                else if (field === 'access_token')
                    config.apiKey = val;
            }
        }
        return config;
    }
    async getAdapter(provider) {
        const cached = this.adapters.get(provider);
        if (cached)
            return cached;
        const config = await this.getConfig(provider);
        let adapter;
        if (config.useMock !== false && !config.apiKey) {
            adapter = new integration_adapter_1.MockAdapter(provider);
        }
        else {
            switch (provider) {
                case 'zahir':
                    adapter = new integration_adapter_1.ZahirAdapter(config.apiUrl || '', config.apiKey || '', config.companyId || '');
                    break;
                case 'quickbooks':
                    adapter = new quickbooks_adapter_1.QuickBooksAdapter(config.apiUrl || '', config.apiKey || '', config.realmId || '');
                    break;
                case 'xero':
                    adapter = new xero_adapter_1.XeroAdapter(config.apiUrl || '', config.apiKey || '', config.tenantId || '');
                    break;
                default:
                    throw new Error(`Unsupported provider: ${provider}`);
            }
        }
        this.adapters.set(provider, adapter);
        return adapter;
    }
    invalidateCache(provider) {
        this.adapters.delete(provider);
    }
}
exports.adapterRegistry = new AdapterRegistry();
