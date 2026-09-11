import React, { useState, useEffect } from 'react';
import { Activity, Clock, Wrench, Filter, RotateCcw } from 'lucide-react';
import { api } from '../../api/client';
import { useSettings } from '../../context/SettingsContext';
import LineChart from '../../components/charts/LineChart';
import Loading from '../../components/ui/Loading';
import ErrorState from '../../components/ui/ErrorState';
import Card, { CardHeader, CardBody, CardTitle } from '../../components/ui/Card';

interface MtbfByAsset {
  assetId: string;
  assetName: string;
  assetCode: string;
  failureCount: number;
  avgHoursBetweenFailures: number;
  message?: string;
}

interface MtbfResponse {
  trend: { month: string; value: number }[];
  current: number | null;
  overall: { avgHoursBetweenFailures: number | null; assetsWithEnoughData: number; message?: string };
  byAsset: MtbfByAsset[];
}

function formatHours(h: number | null) {
  if (h === null || h === undefined) return '-';
  if (h < 1) return `${Math.round(h * 60)} menit`;
  if (h < 24) return `${h.toFixed(1)} jam`;
  return `${(h / 24).toFixed(1)} hari`;
}

export default function MTBFPage() {
  const { settings } = useSettings();
  const goodThreshold = parseFloat(settings.mtbf_good_threshold) || 720;
  const warningThreshold = parseFloat(settings.mtbf_warning_threshold) || 168;

  const [report, setReport] = useState<MtbfResponse | null>(null);
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
    api.get<MtbfResponse>(`/reports/mtbf${qs ? '?' + qs : ''}`)
      .then(setReport)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  const getColor = (h: number | null) => {
    if (h === null) return 'text-slate-400';
    if (h >= goodThreshold) return 'text-green-600';
    if (h >= warningThreshold) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getBg = (h: number | null) => {
    if (h === null) return 'bg-slate-50 border-slate-200';
    if (h >= goodThreshold) return 'bg-green-50 border-green-200';
    if (h >= warningThreshold) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  const getLabel = (h: number | null) => {
    if (h === null) return 'N/A';
    if (h >= goodThreshold) return 'Sangat Baik';
    if (h >= warningThreshold) return 'Baik';
    return 'Perlu Perhatian';
  };

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-900">Mean Time Between Failures (MTBF)</h1>
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
        <Loading text="Loading MTBF data..." />
      ) : report ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`rounded-xl border p-5 ${getBg(report.current)}`}>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 rounded-lg">
                  <Activity className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">MTBF Saat Ini</p>
                  <p className={`text-xl font-bold ${getColor(report.current)}`}>
                    {formatHours(report.current)}
                  </p>
                  <p className="text-[10px] text-slate-400">{getLabel(report.current)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-100 rounded-lg">
                  <Clock className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">MTBF Keseluruhan</p>
                  <p className="text-xl font-bold text-slate-900">
                    {formatHours(report.overall.avgHoursBetweenFailures)}
                  </p>
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
                  <p className="text-xs text-slate-500">Aset dengan Data Cukup</p>
                  <p className="text-xl font-bold text-slate-900">{report.overall.assetsWithEnoughData}</p>
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
              title="MTBF Trend (Last 12 Months)"
              color="#3b82f6"
              height={350}
            />
          )}

          {/* By Asset Table */}
          <Card>
            <CardHeader>
              <CardTitle>MTBF by Aset</CardTitle>
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
                        <th className="text-right py-3 px-4 font-medium text-slate-500">Jumlah Failure</th>
                        <th className="text-right py-3 px-4 font-medium text-slate-500">MTBF (jam)</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-500">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byAsset.map((a) => (
                        <tr key={a.assetId} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-3 px-4 font-medium text-slate-900">{a.assetCode || '-'}</td>
                          <td className="py-3 px-4 text-slate-700">{a.assetName || '-'}</td>
                          <td className="py-3 px-4 text-right text-slate-600">{a.failureCount}</td>
                          <td className={`py-3 px-4 text-right font-medium ${getColor(a.avgHoursBetweenFailures)}`}>
                            {a.avgHoursBetweenFailures.toFixed(1)}
                          </td>
                          <td className="py-3 px-4">
                            {a.message ? (
                              <span className="text-xs text-slate-400">{a.message}</span>
                            ) : (
                              <span className={`text-xs font-medium ${getColor(a.avgHoursBetweenFailures)}`}>
                                {getLabel(a.avgHoursBetweenFailures)}
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
