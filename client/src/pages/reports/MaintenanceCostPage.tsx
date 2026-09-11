import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Package, Wrench, Search, ChevronDown, BarChart3 } from 'lucide-react';
import { api } from '../../api/client';
import LineChart from '../../components/charts/LineChart';
import BarChart from '../../components/charts/BarChart';
import Card, { CardHeader, CardBody, CardTitle } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Loading from '../../components/ui/Loading';
import ErrorState from '../../components/ui/ErrorState';

function formatCurrency(amount: number) {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

function formatMonth(month: string) {
  const [y, m] = month.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

interface CostData {
  totalCost: number;
  woCount: number;
  trend: { month: string; cost: number }[];
  byAsset: { assetName: string; assetCode: string; woCount: number; totalCost: number }[];
  byMonth: { month: string; woCount: number; totalCost: number }[];
  byItem: { itemCode: string; itemName: string; totalQuantity: number; totalCost: number }[];
  byWorkOrder: { id: string; woNumber: string; title: string; closedAt: string; assetName: string; assetCode: string; assignedToName: string; totalCost: number; sparePartCount: number }[];
}

type DetailTab = 'asset' | 'item' | 'monthly';

export default function MaintenanceCostPage() {
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [assetId, setAssetId] = useState('');
  const [assets, setAssets] = useState<{ id: string; assetCode: string; assetName: string }[]>([]);
  const [detailTab, setDetailTab] = useState<DetailTab>('asset');
  const [woSearch, setWoSearch] = useState('');

  const fetchData = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (assetId) params.append('assetId', assetId);

    const qs = params.toString();
    Promise.all([
      api.get<CostData>(`/reports/maintenance-cost${qs ? '?' + qs : ''}`),
      api.get<{ data: any[] }>('/assets?limit=1000'),
    ])
      .then(([costRes, assetRes]) => {
        setData(costRes);
        setAssets(assetRes.data || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  if (error) return <ErrorState message={error} />;

  const avgCostPerWo = data && data.woCount > 0 ? data.totalCost / data.woCount : 0;
  const topAsset = data?.byAsset?.[0];
  const topItem = data?.byItem?.[0];

  const filteredWOs = (data?.byWorkOrder || []).filter((wo) => {
    if (wo.totalCost <= 0) return false;
    if (!woSearch) return true;
    const q = woSearch.toLowerCase();
    return wo.woNumber.toLowerCase().includes(q) ||
      wo.title.toLowerCase().includes(q) ||
      (wo.assetCode || '').toLowerCase().includes(q) ||
      (wo.assetName || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Maintenance Cost Report</h1>
          <p className="text-sm text-slate-500 mt-1">Analisis biaya perawatan untuk tracing dan optimasi</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Search className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600">Filter</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Dari Tanggal</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Sampai Tanggal</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Aset</label>
            <select
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Semua Aset</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>{a.assetCode} - {a.assetName}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={() => fetchData()} disabled={loading} size="sm">Terapkan</Button>
            <Button variant="secondary" onClick={() => { setStartDate(''); setEndDate(''); setAssetId(''); }} size="sm">Reset</Button>
          </div>
        </div>
      </div>

      {loading ? (
        <Loading text="Loading cost data..." />
      ) : data ? (
        <>
          {/* KPI Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={<DollarSign className="h-5 w-5" />}
              iconColor="text-green-600"
              iconBg="bg-green-50"
              label="Total Biaya"
              value={formatCurrency(data.totalCost)}
            />
            <KpiCard
              icon={<Wrench className="h-5 w-5" />}
              iconColor="text-blue-600"
              iconBg="bg-blue-50"
              label="Total WO"
              value={`${data.woCount}`}
              sub={`Rata-rata ${formatCurrency(avgCostPerWo)}/WO`}
            />
            <KpiCard
              icon={<BarChart3 className="h-5 w-5" />}
              iconColor="text-orange-600"
              iconBg="bg-orange-50"
              label="Aset Tertinggi"
              value={topAsset ? topAsset.assetCode : '-'}
              sub={topAsset ? formatCurrency(topAsset.totalCost) : ''}
            />
            <KpiCard
              icon={<Package className="h-5 w-5" />}
              iconColor="text-purple-600"
              iconBg="bg-purple-50"
              label="Item Termahal"
              value={topItem ? topItem.itemCode : '-'}
              sub={topItem ? formatCurrency(topItem.totalCost) : ''}
            />
          </div>

          {/* Section 1: Trend Chart */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">1</span>
                <h2 className="text-sm font-semibold text-slate-900">Tren Biaya Bulanan</h2>
              </div>
            </div>
            <div className="p-6">
              <LineChart
                data={data.trend.map(t => ({ month: formatMonth(t.month), cost: t.cost }))}
                xKey="month"
                yKey="cost"
                color="#10b981"
                height={300}
              />
            </div>
          </div>

          {/* Section 2: Breakdown by Category */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By Asset */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="px-6 py-4 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">2</span>
                  <h2 className="text-sm font-semibold text-slate-900">Biaya per Aset</h2>
                </div>
              </div>
              <div className="p-4">
                {data.byAsset.length > 0 ? (
                  <BarChart
                    data={data.byAsset.slice(0, 10).map(a => ({ name: a.assetCode, cost: a.totalCost }))}
                    xKey="name"
                    yKey="cost"
                    color="#f97316"
                    height={250}
                  />
                ) : (
                  <p className="text-sm text-slate-400 text-center py-12">Tidak ada data</p>
                )}
              </div>
              {data.byAsset.length > 0 && (
                <div className="px-6 pb-4">
                  <div className="space-y-2">
                    {data.byAsset.slice(0, 5).map((a, idx) => (
                      <div key={idx} className="flex items-center gap-3 text-sm">
                        <span className="w-5 text-slate-400 text-right">{idx + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-slate-900">{a.assetCode}</span>
                          <span className="text-slate-500 ml-1">- {a.assetName}</span>
                        </div>
                        <span className="font-medium text-slate-900">{formatCurrency(a.totalCost)}</span>
                        <span className="text-slate-400 w-14 text-right">{data.totalCost > 0 ? ((a.totalCost / data.totalCost) * 100).toFixed(1) : 0}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* By Spare Part */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="px-6 py-4 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">3</span>
                  <h2 className="text-sm font-semibold text-slate-900">Biaya per Spare Part</h2>
                </div>
              </div>
              <div className="p-4">
                {data.byItem.length > 0 ? (
                  <BarChart
                    data={data.byItem.slice(0, 10).map(i => ({ name: i.itemCode, cost: i.totalCost }))}
                    xKey="name"
                    yKey="cost"
                    color="#8b5cf6"
                    height={250}
                  />
                ) : (
                  <p className="text-sm text-slate-400 text-center py-12">Tidak ada data</p>
                )}
              </div>
              {data.byItem.length > 0 && (
                <div className="px-6 pb-4">
                  <div className="space-y-2">
                    {data.byItem.slice(0, 5).map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 text-sm">
                        <span className="w-5 text-slate-400 text-right">{idx + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-slate-900">{item.itemCode}</span>
                          <span className="text-slate-500 ml-1">- {item.itemName}</span>
                        </div>
                        <span className="text-slate-500">{item.totalQuantity} pcs</span>
                        <span className="font-medium text-slate-900">{formatCurrency(item.totalCost)}</span>
                        <span className="text-slate-400 w-14 text-right">{data.totalCost > 0 ? ((item.totalCost / data.totalCost) * 100).toFixed(1) : 0}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Detail Tables with Tabs */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold">4</span>
                <h2 className="text-sm font-semibold text-slate-900">Rincian Detail</h2>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-200">
              <div className="flex gap-0 px-6">
                {([
                  { key: 'asset' as DetailTab, label: 'Per Aset', count: data.byAsset.length },
                  { key: 'item' as DetailTab, label: 'Per Spare Part', count: data.byItem.length },
                  { key: 'monthly' as DetailTab, label: 'Per Bulan', count: data.byMonth.length },
                ]).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setDetailTab(tab.key)}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      detailTab === tab.key
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.label}
                    <span className="ml-1.5 text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{tab.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-0">
              {detailTab === 'asset' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">No</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Kode Aset</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nama Aset</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Jml WO</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Biaya</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Rata-rata/WO</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">% Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.byAsset.map((a, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-3 text-slate-400">{idx + 1}</td>
                          <td className="px-6 py-3 font-medium text-blue-700">{a.assetCode}</td>
                          <td className="px-6 py-3 text-slate-700">{a.assetName}</td>
                          <td className="px-6 py-3 text-center text-slate-700">{a.woCount}</td>
                          <td className="px-6 py-3 text-right font-semibold text-slate-900">{formatCurrency(a.totalCost)}</td>
                          <td className="px-6 py-3 text-right text-slate-600">{a.woCount > 0 ? formatCurrency(a.totalCost / a.woCount) : '-'}</td>
                          <td className="px-6 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-slate-100 rounded-full h-1.5">
                                <div
                                  className="bg-orange-400 h-1.5 rounded-full"
                                  style={{ width: `${data.totalCost > 0 ? Math.max((a.totalCost / data.totalCost) * 100, 2) : 0}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-500 w-12 text-right">
                                {data.totalCost > 0 ? ((a.totalCost / data.totalCost) * 100).toFixed(1) : 0}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 font-semibold">
                        <td className="px-6 py-3" colSpan={3}>Total</td>
                        <td className="px-6 py-3 text-center">{data.woCount}</td>
                        <td className="px-6 py-3 text-right">{formatCurrency(data.totalCost)}</td>
                        <td className="px-6 py-3 text-right">{data.woCount > 0 ? formatCurrency(data.totalCost / data.woCount) : '-'}</td>
                        <td className="px-6 py-3 text-right">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {detailTab === 'item' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">No</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Kode Item</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nama Item</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Qty</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Biaya</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Harga Rata-rata</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">% Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.byItem.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-3 text-slate-400">{idx + 1}</td>
                          <td className="px-6 py-3 font-medium text-purple-700">{item.itemCode}</td>
                          <td className="px-6 py-3 text-slate-700">{item.itemName}</td>
                          <td className="px-6 py-3 text-center text-slate-700">{item.totalQuantity}</td>
                          <td className="px-6 py-3 text-right font-semibold text-slate-900">{formatCurrency(item.totalCost)}</td>
                          <td className="px-6 py-3 text-right text-slate-600">{item.totalQuantity > 0 ? formatCurrency(item.totalCost / item.totalQuantity) : '-'}</td>
                          <td className="px-6 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-slate-100 rounded-full h-1.5">
                                <div
                                  className="bg-purple-400 h-1.5 rounded-full"
                                  style={{ width: `${data.totalCost > 0 ? Math.max((item.totalCost / data.totalCost) * 100, 2) : 0}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-500 w-12 text-right">
                                {data.totalCost > 0 ? ((item.totalCost / data.totalCost) * 100).toFixed(1) : 0}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 font-semibold">
                        <td className="px-6 py-3" colSpan={3}>Total</td>
                        <td className="px-6 py-3 text-center">{data.byItem.reduce((s, i) => s + i.totalQuantity, 0)}</td>
                        <td className="px-6 py-3 text-right">{formatCurrency(data.totalCost)}</td>
                        <td className="px-6 py-3 text-right">-</td>
                        <td className="px-6 py-3 text-right">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {detailTab === 'monthly' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Bulan</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Jml WO</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Biaya</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Rata-rata/WO</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">% Total</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '120px' }}></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.byMonth.map((m, idx) => {
                        const pct = data.totalCost > 0 ? (m.totalCost / data.totalCost) * 100 : 0;
                        const isHighest = idx === data.byMonth.reduce((maxIdx, item, i, arr) =>
                          item.totalCost > arr[maxIdx].totalCost ? i : maxIdx, 0);
                        return (
                          <tr key={idx} className={`hover:bg-slate-50 transition-colors ${isHighest ? 'bg-orange-50/50' : ''}`}>
                            <td className="px-6 py-3 font-medium text-slate-900">{formatMonth(m.month)}</td>
                            <td className="px-6 py-3 text-center text-slate-700">{m.woCount}</td>
                            <td className={`px-6 py-3 text-right font-semibold ${isHighest ? 'text-orange-700' : 'text-slate-900'}`}>
                              {formatCurrency(m.totalCost)}
                            </td>
                            <td className="px-6 py-3 text-right text-slate-600">{m.woCount > 0 ? formatCurrency(m.totalCost / m.woCount) : '-'}</td>
                            <td className="px-6 py-3 text-right">
                              <span className={`text-xs ${isHighest ? 'text-orange-600 font-semibold' : 'text-slate-500'}`}>
                                {pct.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-6 py-3">
                              <div className="w-full bg-slate-100 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${isHighest ? 'bg-orange-500' : 'bg-blue-400'}`}
                                  style={{ width: `${Math.max(pct, 1)}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 font-semibold">
                        <td className="px-6 py-3">Total</td>
                        <td className="px-6 py-3 text-center">{data.woCount}</td>
                        <td className="px-6 py-3 text-right">{formatCurrency(data.totalCost)}</td>
                        <td className="px-6 py-3 text-right">{data.woCount > 0 ? formatCurrency(data.totalCost / data.woCount) : '-'}</td>
                        <td className="px-6 py-3 text-right">100%</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Per WO Detail */}
          {filteredWOs.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="px-6 py-4 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold">5</span>
                    <h2 className="text-sm font-semibold text-slate-900">Rincian per Work Order</h2>
                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{filteredWOs.length} WO</span>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={woSearch}
                      onChange={(e) => setWoSearch(e.target.value)}
                      placeholder="Cari WO, judul, aset..."
                      className="pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-sm w-64 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">No</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">WO Number</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Judul</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Aset</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Teknisi</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">SP</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Biaya</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">% Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredWOs.map((wo, idx) => {
                      const pct = data.totalCost > 0 ? (wo.totalCost / data.totalCost) * 100 : 0;
                      const isTop3 = idx < 3;
                      return (
                        <tr key={idx} className={`hover:bg-slate-50 transition-colors ${isTop3 ? 'bg-red-50/30' : ''}`}>
                          <td className="px-6 py-3 text-slate-400">{idx + 1}</td>
                          <td className="px-6 py-3">
                            <span className="font-medium text-blue-600">{wo.woNumber}</span>
                          </td>
                          <td className="px-6 py-3 text-slate-700 max-w-[200px] truncate">{wo.title}</td>
                          <td className="px-6 py-3">
                            <span className="text-sm text-slate-700">{wo.assetCode}</span>
                          </td>
                          <td className="px-6 py-3 text-slate-600">{wo.assignedToName || '-'}</td>
                          <td className="px-6 py-3 text-center text-slate-700">{wo.sparePartCount}</td>
                          <td className={`px-6 py-3 text-right font-semibold ${isTop3 ? 'text-red-700' : 'text-slate-900'}`}>
                            {formatCurrency(wo.totalCost)}
                          </td>
                          <td className="px-6 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-slate-100 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${isTop3 ? 'bg-red-500' : 'bg-slate-400'}`}
                                  style={{ width: `${Math.max(pct, 2)}%` }}
                                />
                              </div>
                              <span className={`text-xs w-12 text-right ${isTop3 ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                                {pct.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function KpiCard({ icon, iconColor, iconBg, label, value, sub }: {
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${iconBg}`}>
          <span className={iconColor}>{icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-lg font-bold text-slate-900 truncate">{value}</p>
          {sub && <p className="text-xs text-slate-400 truncate">{sub}</p>}
        </div>
      </div>
    </div>
  );
}
