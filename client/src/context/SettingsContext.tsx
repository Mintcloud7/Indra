import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

interface Settings {
  companyName: string;
  logoUrl: string;
  maintenanceEmail: string;
  autoAssignWorkOrders: boolean;
  pmNotificationDays: string;
  lowStockThreshold: string;
  downtime_good_threshold: string;
  downtime_warning_threshold: string;
  mtbf_good_threshold: string;
  mtbf_warning_threshold: string;
}

const defaultSettings: Settings = {
  companyName: 'INDRA',
  logoUrl: '',
  maintenanceEmail: 'maintenance@example.com',
  autoAssignWorkOrders: false,
  pmNotificationDays: '7',
  lowStockThreshold: '5',
  downtime_good_threshold: '4',
  downtime_warning_threshold: '8',
  mtbf_good_threshold: '720',
  mtbf_warning_threshold: '168',
};

interface SettingsContextType {
  settings: Settings;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  loading: false,
  refresh: async () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<Settings>('/settings');
      setSettings({ ...defaultSettings, ...res });
    } catch {
      // use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <SettingsContext.Provider value={{ settings, loading, refresh: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
