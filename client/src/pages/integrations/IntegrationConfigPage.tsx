import React, { useState, useEffect } from 'react';
import { Settings, Save, Plug, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { IntegrationProvider } from '../../api/types';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card, { CardHeader, CardBody, CardTitle } from '../../components/ui/Card';
import Loading from '../../components/ui/Loading';
import { useNotification } from '../../context/NotificationContext';

interface ProviderConfig {
  apiUrl?: { value: string; description: string };
  apiKey?: { value: string; description: string };
  companyId?: { value: string; description: string };
  tenantId?: { value: string; description: string };
  realmId?: { value: string; description: string };
  useMock?: { value: string; description: string };
}

export default function IntegrationConfigPage() {
  const { addToast } = useNotification();
  const { hasPermission } = useAuth();
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('zahir');
  const [config, setConfig] = useState<ProviderConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    api.get<IntegrationProvider[]>('/integrations/providers')
      .then(setProviders)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setTestResult(null);
    api.get<ProviderConfig>(`/integrations/${selectedProvider}/config`)
      .then(setConfig)
      .catch(() => setConfig({}))
      .finally(() => setLoading(false));
  }, [selectedProvider]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      if (config.apiUrl) payload.apiUrl = config.apiUrl.value;
      if (config.apiKey) payload.apiKey = config.apiKey.value;
      if (config.companyId) payload.companyId = config.companyId.value;
      if (config.tenantId) payload.tenantId = config.tenantId.value;
      if (config.realmId) payload.realmId = config.realmId.value;
      if (config.useMock) payload.useMock = config.useMock.value === 'true';

      await api.put(`/integrations/${selectedProvider}/config`, payload);
      addToast(`${selectedProvider} configuration saved`, 'success');
    } catch {
      addToast('Failed to save configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.post<{ success: boolean; message: string }>(`/integrations/${selectedProvider}/test`);
      setTestResult(result.success ? 'success' : 'error');
      addToast(result.message, result.success ? 'success' : 'error');
    } catch {
      setTestResult('error');
      addToast('Connection test failed', 'error');
    } finally {
      setTesting(false);
    }
  };

  const updateConfig = (field: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      [field]: { value, description: prev[field as keyof ProviderConfig]?.description || field }
    }));
  };

  const currentProvider = providers.find(p => p.id === selectedProvider);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Integration Settings</h1>

      <div className="flex flex-wrap gap-3">
        {providers.map(provider => (
          <button
            key={provider.id}
            onClick={() => setSelectedProvider(provider.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              selectedProvider === provider.id
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Plug className="h-4 w-4" />
            <span className="font-medium">{provider.name}</span>
          </button>
        ))}
      </div>

      {currentProvider && (
        <p className="text-sm text-slate-500">{currentProvider.description}</p>
      )}

      {loading ? (
        <Loading text="Loading configuration..." />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{currentProvider?.name || selectedProvider} Configuration</CardTitle>
              <div className="flex items-center gap-2">
                {testResult === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
                {testResult === 'error' && <XCircle className="h-5 w-5 text-red-500" />}
                {hasPermission('integrations.update') && (
                  <Button variant="secondary" onClick={handleTest} disabled={testing}>
                    {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                    Test Connection
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <Input
              label="API URL"
              value={config.apiUrl?.value || ''}
              onChange={(e) => updateConfig('apiUrl', e.target.value)}
              placeholder={`Enter ${currentProvider?.name} API URL`}
            />
            <Input
              label={selectedProvider === 'quickbooks' ? 'Access Token' : 'API Key'}
              type="password"
              value={config.apiKey?.value || ''}
              onChange={(e) => updateConfig('apiKey', e.target.value)}
              placeholder={`Enter ${currentProvider?.name} API key or access token`}
            />
            {(selectedProvider === 'zahir' || selectedProvider === 'quickbooks') && (
              <Input
                label={selectedProvider === 'quickbooks' ? 'Realm ID' : 'Company ID'}
                value={(selectedProvider === 'quickbooks' ? config.realmId?.value : config.companyId?.value) || ''}
                onChange={(e) => updateConfig(selectedProvider === 'quickbooks' ? 'realmId' : 'companyId', e.target.value)}
                placeholder={`Enter ${currentProvider?.name} Company/Realm ID`}
              />
            )}
            {selectedProvider === 'xero' && (
              <Input
                label="Tenant ID"
                value={config.tenantId?.value || ''}
                onChange={(e) => updateConfig('tenantId', e.target.value)}
                placeholder="Enter Xero Tenant ID"
              />
            )}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="useMock"
                checked={config.useMock?.value === 'true'}
                onChange={(e) => updateConfig('useMock', e.target.checked ? 'true' : 'false')}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="useMock" className="text-sm font-medium text-slate-700">
                Use mock adapter (development mode)
              </label>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="flex justify-end">
        {hasPermission('integrations.update') && (
          <Button onClick={handleSave} loading={saving}>
            <Save className="h-4 w-4" />
            Save Configuration
          </Button>
        )}
      </div>
    </div>
  );
}
