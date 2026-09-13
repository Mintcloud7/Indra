import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Printer, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Loading from '../../components/ui/Loading';
import ErrorState from '../../components/ui/ErrorState';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700 border-blue-200',
  ASSIGNED: 'bg-orange-100 text-orange-700 border-orange-200',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  ON_HOLD: 'bg-red-100 text-red-700 border-red-200',
  CLOSED: 'bg-green-100 text-green-700 border-green-200',
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700 border-red-200',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
  MEDIUM: 'bg-blue-100 text-blue-700 border-blue-200',
  LOW: 'bg-green-100 text-green-700 border-green-200',
};

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTime(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface WODetail {
  id: string;
  woNumber: string;
  title: string;
  description: string;
  assetId: string;
  assetName: string;
  assetCode: string;
  location: string;
  status: string;
  priority: string;
  reportedById: string;
  reportedByName: string;
  supervisorId: string;
  supervisorName: string;
  assignedToId: string;
  assignedToName: string;
  dueDate: string;
  startedAt: string;
  startedByName: string;
  completedAt: string;
  closedAt: string;
  problemDescription: string;
  repairInstruction: string;
  workPerformed: string;
  rootCause: string;
  resolution: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  statusHistory: any[];
  checklists: any[];
  attachments: any[];
  spareParts: any[];
}

export default function WorkOrderReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { addToast } = useNotification();
  const [wo, setWo] = useState<WODetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchWorkOrder();
  }, [id]);

  const fetchWorkOrder = async () => {
    setLoading(true);
    try {
      const data = await api.get<WODetail>(`/work-orders/${id}`);
      setWo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat Work Order');
    } finally {
      setLoading(false);
    }
  };

  const handleExportDocx = async () => {
    if (!id) return;
    setExporting(true);
    try {
      const url = `${API_URL}/reports/work-orders/${id}/export-docx`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Gagal mengunduh file');
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      let filename = `Work_Order_${wo?.woNumber || id}.docx`;
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      a.remove();
      addToast('Word file berhasil diunduh', 'success');
    } catch (err: any) {
      addToast(err.message || 'Gagal mengunduh', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <Loading text="Memuat Work Order..." />;
  if (error) return <ErrorState message={error} onRetry={fetchWorkOrder} />;
  if (!wo) return null;

  const now = new Date();
  const reportDate = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  const completedChecklists = (wo.checklists || []).filter((c: any) => c.completed).length;
  const totalChecklists = (wo.checklists || []).length;
  const totalSpareCost = (wo.spareParts || []).reduce((sum: number, sp: any) => sum + (Number(sp.totalCost) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header - hidden on print */}
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/reports/work-orders')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Laporan Work Order</h1>
            <p className="text-sm text-slate-500">{wo.woNumber} - {wo.title}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button onClick={handleExportDocx} disabled={exporting} loading={exporting}>
            <Download className="h-4 w-4" />
            Download Word
          </Button>
        </div>
      </div>

      {/* Report Content - A4-style */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm print:shadow-none print:border-0 max-w-5xl mx-auto">
        <div className="p-8 print:p-6">

          {/* Title Header */}
          <div className="text-center mb-6 border-b-2 border-blue-600 pb-4">
            <h1 className="text-3xl font-bold text-blue-800">WORK ORDER REPORT</h1>
          </div>

          {/* WO Info Table */}
          <Section title="1. Informasi Work Order">
            <InfoTable rows={[
              ['WO Number', wo.woNumber, 'Status', wo.status?.replace('_', ' ') || '-'],
              ['Judul', wo.title, 'Prioritas', wo.priority || '-'],
              ['Aset', wo.assetName ? `${wo.assetCode} - ${wo.assetName}` : '-', 'Lokasi', wo.location || wo.assetName || '-'],
              ['Dilaporkan oleh', wo.reportedByName || '-', 'Tanggal Dibuat', formatDate(wo.createdAt)],
              ['Ditugaskan ke', wo.assignedToName || '-', 'Supervisor', wo.supervisorName || '-'],
              ['Tanggal Mulai', formatDateTime(wo.startedAt), 'Tanggal Selesai', formatDateTime(wo.closedAt || wo.completedAt)],
            ]} />
          </Section>

          {/* Problem Description */}
          {wo.problemDescription && (
            <Section title="2. Deskripsi Masalah">
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{wo.problemDescription}</p>
              </div>
            </Section>
          )}

          {/* Work Detail */}
          {(wo.workPerformed || wo.rootCause || wo.resolution || wo.repairInstruction || wo.notes) && (
            <Section title={wo.problemDescription ? '3. Detail Pekerjaan' : '2. Detail Pekerjaan'}>
              <div className="space-y-4">
                {wo.repairInstruction && (
                  <FieldBlock label="Instruksi Perbaikan" value={wo.repairInstruction} />
                )}
                {wo.workPerformed && (
                  <FieldBlock label="Pekerjaan yang Dilakukan" value={wo.workPerformed} />
                )}
                {wo.rootCause && (
                  <FieldBlock label="Akar Masalah (Root Cause)" value={wo.rootCause} />
                )}
                {wo.resolution && (
                  <FieldBlock label="Resolusi / Tindakan Perbaikan" value={wo.resolution} />
                )}
                {wo.notes && (
                  <FieldBlock label="Catatan" value={wo.notes} />
                )}
              </div>
            </Section>
          )}

          {/* Checklists */}
          {wo.checklists && wo.checklists.length > 0 && (
            <Section title={wo.problemDescription ? '4. Checklist Pekerjaan' : '3. Checklist Pekerjaan'}>
              <div className="mb-3 flex items-center gap-3">
                <span className="text-sm text-slate-600">Progress:</span>
                <div className="flex-1 bg-slate-200 rounded-full h-3 max-w-xs">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all"
                    style={{ width: `${totalChecklists > 0 ? (completedChecklists / totalChecklists) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-slate-700">{completedChecklists}/{totalChecklists}</span>
              </div>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-blue-800 text-white">
                    <th className="px-3 py-2 text-left w-12">No.</th>
                    <th className="px-3 py-2 text-left">Item Pekerjaan</th>
                    <th className="px-3 py-2 text-center w-20">Wajib</th>
                    <th className="px-3 py-2 text-center w-28">Status</th>
                    <th className="px-3 py-2 text-left w-40">Diselesaikan Oleh</th>
                    <th className="px-3 py-2 text-left w-40">Tanggal</th>
                  </tr>
                </thead>
                <tbody>
                  {wo.checklists.map((cl: any, idx: number) => (
                    <tr key={cl.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="px-3 py-2 text-center border border-slate-200">{idx + 1}</td>
                      <td className="px-3 py-2 border border-slate-200">{cl.title || cl.description || '-'}</td>
                      <td className="px-3 py-2 text-center border border-slate-200">{cl.required ? 'Ya' : 'Tidak'}</td>
                      <td className="px-3 py-2 text-center border border-slate-200">
                        {cl.completed ? (
                          <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                            <CheckCircle className="h-3.5 w-3.5" /> Selesai
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                            <AlertTriangle className="h-3.5 w-3.5" /> Belum
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 border border-slate-200">{cl.completedByName || '-'}</td>
                      <td className="px-3 py-2 border border-slate-200 text-xs">{formatDateTime(cl.completedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* Spare Parts */}
          {wo.spareParts && wo.spareParts.length > 0 && (
            <Section title={wo.problemDescription ? '5. Spare Parts' : '4. Spare Parts'}>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-blue-800 text-white">
                    <th className="px-3 py-2 text-left w-12">No.</th>
                    <th className="px-3 py-2 text-left">Kode Item</th>
                    <th className="px-3 py-2 text-left">Nama Item</th>
                    <th className="px-3 py-2 text-center">Qty Direncanakan</th>
                    <th className="px-3 py-2 text-center">Qty Digunakan</th>
                    <th className="px-3 py-2 text-center">Satuan</th>
                    <th className="px-3 py-2 text-right">Harga Satuan</th>
                    <th className="px-3 py-2 text-right">Total Biaya</th>
                  </tr>
                </thead>
                <tbody>
                  {wo.spareParts.map((sp: any, idx: number) => (
                    <tr key={sp.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="px-3 py-2 text-center border border-slate-200">{idx + 1}</td>
                      <td className="px-3 py-2 border border-slate-200">{sp.itemCode || '-'}</td>
                      <td className="px-3 py-2 border border-slate-200">{sp.itemName || '-'}</td>
                      <td className="px-3 py-2 text-center border border-slate-200">{sp.plannedQuantity || 0}</td>
                      <td className="px-3 py-2 text-center border border-slate-200">{sp.usedQuantity || 0}</td>
                      <td className="px-3 py-2 text-center border border-slate-200">{sp.unit || '-'}</td>
                      <td className="px-3 py-2 text-right border border-slate-200">{sp.unitCost ? `Rp ${Number(sp.unitCost).toLocaleString('id-ID')}` : '-'}</td>
                      <td className="px-3 py-2 text-right border border-slate-200">{sp.totalCost ? `Rp ${Number(sp.totalCost).toLocaleString('id-ID')}` : '-'}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-bold">
                    <td colSpan={6} className="px-3 py-2 text-right border border-slate-200">TOTAL</td>
                    <td className="px-3 py-2 text-right border border-slate-200"></td>
                    <td className="px-3 py-2 text-right border border-slate-200 text-blue-700">
                      Rp {totalSpareCost.toLocaleString('id-ID')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>
          )}

          {/* Status History */}
          {wo.statusHistory && wo.statusHistory.length > 0 && (
            <Section title={wo.problemDescription ? '6. Riwayat Status' : '5. Riwayat Status'}>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-blue-800 text-white">
                    <th className="px-3 py-2 text-left w-12">No.</th>
                    <th className="px-3 py-2 text-left">Dari Status</th>
                    <th className="px-3 py-2 text-left">Ke Status</th>
                    <th className="px-3 py-2 text-left">Diubah Oleh</th>
                    <th className="px-3 py-2 text-left">Catatan</th>
                    <th className="px-3 py-2 text-left">Tanggal</th>
                  </tr>
                </thead>
                <tbody>
                  {wo.statusHistory.map((sh: any, idx: number) => (
                    <tr key={sh.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="px-3 py-2 text-center border border-slate-200">{idx + 1}</td>
                      <td className="px-3 py-2 border border-slate-200">{sh.fromStatus?.replace('_', ' ') || '-'}</td>
                      <td className="px-3 py-2 border border-slate-200 font-medium">{sh.toStatus?.replace('_', ' ') || '-'}</td>
                      <td className="px-3 py-2 border border-slate-200">{sh.changedByName || '-'}</td>
                      <td className="px-3 py-2 border border-slate-200">{sh.notes || '-'}</td>
                      <td className="px-3 py-2 border border-slate-200 text-xs">{formatDateTime(sh.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* Signature Section */}
          <div className="mt-10 pt-6 border-t-2 border-slate-200">
            <h3 className="text-lg font-bold text-blue-800 mb-6">Tanda Tangan</h3>
            <div className="grid grid-cols-3 gap-8">
              <SignatureBlock label="Dikerjakan oleh" name={wo.assignedToName || 'Teknisi'} date={reportDate} />
              <SignatureBlock label="Diperiksa oleh" name={wo.supervisorName || 'Supervisor'} date={reportDate} />
              <SignatureBlock label="Disetujui oleh" name="Manager / Plant Head" date={reportDate} />
            </div>
          </div>

          {/* Footer Disclaimer */}
          <div className="mt-8 pt-4 border-t border-slate-200 text-center">
            <p className="text-xs text-slate-400 italic">
              Dokumen ini dihasilkan secara otomatis oleh INDRA. Laporan ini merupakan dokumen resmi untuk keperluan audit dan pelaporan pemeliharaan.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-bold text-blue-800 mb-3 pb-1 border-b border-blue-200">{title}</h2>
      {children}
    </div>
  );
}

function InfoTable({ rows }: { rows: string[][] }) {
  return (
    <table className="w-full text-sm border-collapse">
      <tbody>
        {rows.map((row, idx) => (
          <tr key={idx} className={idx % 2 === 0 ? 'bg-blue-50' : 'bg-white'}>
            <td className="px-4 py-2.5 font-semibold text-slate-700 border border-slate-200 w-[15%]">{row[0]}</td>
            <td className="px-4 py-2.5 text-slate-900 border border-slate-200 w-[35%]">{row[1]}</td>
            <td className="px-4 py-2.5 font-semibold text-slate-700 border border-slate-200 w-[15%]">{row[2]}</td>
            <td className="px-4 py-2.5 text-slate-900 border border-slate-200 w-[35%]">{row[3]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FieldBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-700 mb-1">{label}:</p>
      <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
        <p className="text-sm text-slate-700 whitespace-pre-wrap">{value}</p>
      </div>
    </div>
  );
}

function SignatureBlock({ label, name, date }: { label: string; name: string; date: string }) {
  return (
    <div className="text-center">
      <p className="text-sm text-slate-500 mb-8">{label}:</p>
      <p className="text-sm text-slate-400 mb-1">_________________________</p>
      <p className="text-sm font-bold text-slate-800">{name}</p>
      <p className="text-xs text-slate-400 mt-1">Tanggal: {date}</p>
    </div>
  );
}
