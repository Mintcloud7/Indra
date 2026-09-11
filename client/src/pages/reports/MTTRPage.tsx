import React, { useState, useEffect } from 'react';
import { Clock, Activity, Wrench, Filter, RotateCcw } from 'lucide-react';
import { api } from '../../api/client';
import { useSettings } from '../../context/SettingsContext';
import LineChart from '../../components/charts/LineChart';
import Loading from '../../components/ui/Loading';
import ErrorState from '../../components/ui/ErrorState';
import Card, { CardHeader, CardBody, CardTitle } from '../../components/ui/Card';

interface MttrByAsset {
  assetId: string;
  assetName: string;
  assetCode: string;
  count: number;
  avgHours: number;
  message?: string;
}

interface MttrResponse {
  trend: { month: string; value: number }[];
  current: number;
  overall: { count: number; avgHours: number; message?: string };
  byAsset: MttrByAsset[];
}

function formatHours(h: number) {
  if (h < 1) return `${Math.round(h * 60)} menit`;
  if (h < 24) return `${h.toFixed(1)} jam`;
  return `${(h / 24).toFixed(1)} hari`;
}

export default function MTTRPage() {
  const { settings } = useSettings();
  const goodThreshold = parseFloat(settings.downtime_good_threshold) || 4;
  const warningThreshold = parseFloat(settings.downtime_warning_threshold) || 8;

  const [report, setReport] = useState<MttrResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchData = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const qs = params.toString();
    api.get<MttrResponse>(`/reports/downtime${qs ? '?' + qs : ''}`)
      .then(setReport)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  const getColor = (h: number) => {
    if (h <= goodThreshold) return 'text-green-600';
    if (h <= warningThreshold) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getBg = (h: number) => {
    if (h <= goodThreshold) return 'bg-green-50 border-green-200';
    if (h <= warningThreshold) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  const getLabel = (h: number) => {
    if (h <= goodThreshold) return 'Baik';
    if (h <= warningThreshold) return 'Cukup';
    return 'Perlu Perbaikan';
  };

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-6 w-6 text-purple-600" />
          <h1 className="text-2xl font-bold text-slate-900">Downtime</h1>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardBody className="flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Filter className="h-4 w-4" />
            <span className="font-medium">Filter:</span>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Dari Tanggal</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Sampai Tanggal</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <button onClick={fetchData} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            Terapkan
          </button>
          <button onClick={resetFilters} className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </CardBody>
      </Card>

      {loading ? (
        <Loading text="Loading downtime data..." />
      ) : report ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`rounded-xl border p-5 ${getBg(report.current)}`}>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-100 rounded-lg">
                  <Clock className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Downtime Saat Ini</p>
                  <p className={`text-xl font-bold ${getColor(report.current)}`}>{formatHours(report.current)}</p>
                  <p className="text-[10px] text-slate-400">{getLabel(report.current)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 rounded-lg">
                  <Activity className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Downtime Keseluruhan</p>
                  <p className="text-xl font-bold text-slate-900">{formatHours(report.overall.avgHours)}</p>
                  {report.overall.message && <p className="text-[10px] text-slate-400">{report.overall.message}</p>}
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-green-100 rounded-lg">
                  <Wrench className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">WO Selesai</p>
                  <p className="text-xl font-bold text-slate-900">{report.overall.count}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Trend Chart */}
          {report.trend.length > 0 && (
            <LineChart
              data={report.trend}
              xKey="month"
              yKey="value"
              title="Downtime Trend (Last 12 Months)"
              color="#8b5cf6"
              height={350}
            />
          )}

          {/* By Asset Table */}
          <Card>
            <CardHeader>
              <CardTitle>Downtime by Aset</CardTitle>
            </CardHeader>
            <CardBody>
              {report.byAsset.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">Tidak ada data</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-4 font-medium text-slate-500">Kode Aset</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-500">Nama Aset</th>
                        <th className="text-right py-3 px-4 font-medium text-slate-500">WO Selesai</th>
                        <th className="text-right py-3 px-4 font-medium text-slate-500">Downtime (jam)</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-500">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byAsset.map((a) => (
                        <tr key={a.assetId} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-3 px-4 font-medium text-slate-900">{a.assetCode}</td>
                          <td className="py-3 px-4 text-slate-700">{a.assetName}</td>
                          <td className="py-3 px-4 text-right text-slate-600">{a.count}</td>
                          <td className={`py-3 px-4 text-right font-medium ${getColor(a.avgHours)}`}>
                            {a.avgHours.toFixed(1)}
                          </td>
                          <td className="py-3 px-4">
                            {a.message ? (
                              <span className="text-xs text-slate-400">{a.message}</span>
                            ) : (
                              <span className={`text-xs font-medium ${getColor(a.avgHours)}`}>
                                {getLabel(a.avgHours)}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </>
      ) : null}
    </div>
  );
}
