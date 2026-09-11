import { IIntegrationAdapter, MockAdapter, ZahirAdapter } from './integration-adapter';
import { QuickBooksAdapter } from './quickbooks.adapter';
import { XeroAdapter } from './xero.adapter';
import { getDb } from '../../../database/connection';

function formatRow(result: any, index: number = 0): any {
  if (!result[0] || !result[0].values[index]) return null;
  const obj: any = {};
  result[0].columns.forEach((col: string, i: number) => {
    obj[col] = result[0].values[index][i];
  });
  return obj;
}

export interface ProviderConfig {
  provider: string;
  apiUrl?: string;
  apiKey?: string;
  companyId?: string;
  tenantId?: string;
  realmId?: string;
  useMock?: boolean;
}

export const SUPPORTED_PROVIDERS = [
  { id: 'zahir', name: 'Zahir Accounting', description: 'Indonesian SaaS accounting software' },
  { id: 'quickbooks', name: 'QuickBooks', description: 'Intuit QuickBooks Online' },
  { id: 'xero', name: 'Xero', description: 'Xero cloud accounting' },
];

class AdapterRegistry {
  private adapters: Map<string, IIntegrationAdapter> = new Map();

  async getConfig(provider: string): Promise<ProviderConfig> {
    const db = await getDb();
    const prefix = `${provider}_`;
    const result = db.exec(
      "SELECT key, value FROM integration_configs WHERE key LIKE ?",
      [`${prefix}%`]
    );

    const config: ProviderConfig = { provider };
    if (result[0]) {
      for (const row of result[0].values) {
        const key = row[0] as string;
        const val = row[1] as string;
        const field = key.replace(prefix, '');
        if (field === 'use_mock') config.useMock = val === 'true';
        else if (field === 'api_url') config.apiUrl = val;
        else if (field === 'api_key') config.apiKey = val;
        else if (field === 'company_id') config.companyId = val;
        else if (field === 'tenant_id') config.tenantId = val;
        else if (field === 'realm_id') config.realmId = val;
        else if (field === 'access_token') config.apiKey = val;
      }
    }
    return config;
  }

  async getAdapter(provider: string): Promise<IIntegrationAdapter> {
    const cached = this.adapters.get(provider);
    if (cached) return cached;

    const config = await this.getConfig(provider);

    let adapter: IIntegrationAdapter;

    if (config.useMock !== false && !config.apiKey) {
      adapter = new MockAdapter(provider);
    } else {
      switch (provider) {
        case 'zahir':
          adapter = new ZahirAdapter(
            config.apiUrl || '',
            config.apiKey || '',
            config.companyId || ''
          );
          break;
        case 'quickbooks':
          adapter = new QuickBooksAdapter(
            config.apiUrl || '',
            config.apiKey || '',
            config.realmId || ''
          );
          break;
        case 'xero':
          adapter = new XeroAdapter(
            config.apiUrl || '',
            config.apiKey || '',
            config.tenantId || ''
          );
          break;
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    }

    this.adapters.set(provider, adapter);
    return adapter;
  }

  invalidateCache(provider: string): void {
    this.adapters.delete(provider);
  }
}

export const adapterRegistry = new AdapterRegistry();
