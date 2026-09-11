import React, { useState, useEffect } from 'react';
import { Package, DollarSign, BarChart3, TrendingUp, Filter, RotateCcw } from 'lucide-react';
import { api } from '../../api/client';
import BarChart from '../../components/charts/BarChart';
import Loading from '../../components/ui/Loading';
import ErrorState from '../../components/ui/ErrorState';
import Card, { CardHeader, CardBody, CardTitle } from '../../components/ui/Card';

interface UsageByItem {
  itemCode: string;
  itemName: string;
  unit: string;
  woCount: number;
  totalQuantity: number;
  totalCost: number;
}

interface UsageByAsset {
  assetCode: string;
  assetName: string;
  woCount: number;
  totalQuantity: number;
  totalCost: number;
}

interface UsageByMonth {
  month: string;
  totalQuantity: number;
  totalCost: number;
}

interface ReportData {
  totalQuantity: number;
  totalCost: number;
  data: { name: string; quantity: number }[];
  byItem: UsageByItem[];
  byAsset: UsageByAsset[];
  byMonth: UsageByMonth[];
}

function formatCurrency(val: number) {
  return 'Rp ' + val.toLocaleString('id-ID');
}

export default function SparePartUsagePage() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeTab, setActiveTab] = useState<'item' | 'asset' | 'month'>('item');

  const fetchData = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const qs = params.toString();
    api.get<ReportData>(`/reports/spare-part-usage${qs ? '?' + qs : ''}`)
      .then(setReport)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-6 w-6 text-purple-600" />
          <h1 className="text-2xl font-bold text-slate-900">Spare Part Usage Report</h1>
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
        <Loading text="Loading usage data..." />
      ) : report ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-100 rounded-lg">
                  <Package className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total Quantity</p>
                  <p className="text-xl font-bold text-slate-900">{report.totalQuantity.toLocaleString('id-ID')}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-green-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total Biaya</p>
                  <p className="text-xl font-bold text-slate-900">{formatCurrency(report.totalCost)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Jenis Spare Part</p>
                  <p className="text-xl font-bold text-slate-900">{report.byItem.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Chart */}
          {report.data.length > 0 && (
            <BarChart
              data={report.data}
              xKey="name"
              yKey="quantity"
              title="Top Used Spare Parts"
              color="#8b5cf6"
              height={350}
            />
          )}

          {/* Tabs */}
          <Card>
            <CardHeader>
              <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                {([
                  { key: 'item' as const, label: 'By Spare Part' },
                  { key: 'asset' as const, label: 'By Asset' },
                  { key: 'month' as const, label: 'By Bulan' },
                ]).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      activeTab === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardBody>
              {/* By Item Table */}
              {activeTab === 'item' && (
                report.byItem.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">Tidak ada data</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 font-medium text-slate-500">Kode</th>
                          <th className="text-left py-3 px-4 font-medium text-slate-500">Nama Item</th>
                          <th className="text-left py-3 px-4 font-medium text-slate-500">Unit</th>
                          <th className="text-right py-3 px-4 font-medium text-slate-500">WO</th>
                          <th className="text-right py-3 px-4 font-medium text-slate-500">Qty</th>
                          <th className="text-right py-3 px-4 font-medium text-slate-500">Total Biaya</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.byItem.map((item) => (
                          <tr key={item.itemCode} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-3 px-4 font-medium text-slate-900">{item.itemCode}</td>
                            <td className="py-3 px-4 text-slate-700">{item.itemName}</td>
                            <td className="py-3 px-4 text-slate-500">{item.unit}</td>
                            <td className="py-3 px-4 text-right text-slate-600">{item.woCount}</td>
                            <td className="py-3 px-4 text-right font-medium text-slate-900">{item.totalQuantity}</td>
                            <td className="py-3 px-4 text-right text-slate-700">{formatCurrency(item.totalCost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {/* By Asset Table */}
              {activeTab === 'asset' && (
                report.byAsset.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">Tidak ada data</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 font-medium text-slate-500">Kode Aset</th>
                          <th className="text-left py-3 px-4 font-medium text-slate-500">Nama Aset</th>
                          <th className="text-right py-3 px-4 font-medium text-slate-500">WO</th>
                          <th className="text-right py-3 px-4 font-medium text-slate-500">Qty</th>
                          <th className="text-right py-3 px-4 font-medium text-slate-500">Total Biaya</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.byAsset.map((a) => (
                          <tr key={a.assetCode || 'unknown'} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-3 px-4 font-medium text-slate-900">{a.assetCode || '-'}</td>
                            <td className="py-3 px-4 text-slate-700">{a.assetName || 'Umum'}</td>
                            <td className="py-3 px-4 text-right text-slate-600">{a.woCount}</td>
                            <td className="py-3 px-4 text-right font-medium text-slate-900">{a.totalQuantity}</td>
                            <td className="py-3 px-4 text-right text-slate-700">{formatCurrency(a.totalCost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {/* By Month Table */}
              {activeTab === 'month' && (
                report.byMonth.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">Tidak ada data</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 font-medium text-slate-500">Bulan</th>
                          <th className="text-right py-3 px-4 font-medium text-slate-500">Qty</th>
                          <th className="text-right py-3 px-4 font-medium text-slate-500">Total Biaya</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.byMonth.map((m) => (
                          <tr key={m.month} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-3 px-4 font-medium text-slate-900">{m.month}</td>
                            <td className="py-3 px-4 text-right font-medium text-slate-900">{m.totalQuantity}</td>
                            <td className="py-3 px-4 text-right text-slate-700">{formatCurrency(m.totalCost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </CardBody>
          </Card>
        </>
      ) : null}
    </div>
  );
}
