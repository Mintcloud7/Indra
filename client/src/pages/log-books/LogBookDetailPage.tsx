import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Wrench, Package, Clock, CheckCircle, XCircle, Pencil, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { LogBook } from '../../api/types';
import Badge from '../../components/ui/Badge';
import Loading from '../../components/ui/Loading';
import ErrorState from '../../components/ui/ErrorState';
import { useAuth } from '../../context/AuthContext';

const activityTypes: Record<string, string> = {
  CORRECTIVE: 'Corrective',
  PREVENTIVE: 'Preventive',
  INSPECTION: 'Inspection',
  EMERGENCY: 'Emergency',
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatDuration(minutes: number) {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function parseNotes(notes: string) {
  const lines = notes.split('\n');
  const header: string[] = [];
  const checklist: { done: boolean; text: string }[] = [];
  let inChecklist = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^Checklist\s*\(\d+\/\d+/.test(trimmed)) {
      inChecklist = true;
      continue;
    }
    if (inChecklist) {
      const done = trimmed.startsWith('✓') || trimmed.startsWith('\u2713');
      const text = trimmed.replace(/^[✓✗]\s*/, '').replace(/\(\d{1,2}\.\d{2}\)\s*$/, '').trim();
      const timeMatch = trimmed.match(/\((\d{1,2}\.\d{2})\)\s*$/);
      checklist.push({ done, text: text + (timeMatch ? ` (${timeMatch[1]})` : '') });
    } else {
      header.push(trimmed);
    }
  }
  return { header, checklist };
}

export default function LogBookDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const [log, setLog] = useState<LogBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api.get<LogBook>(`/log-books/${id}`)
      .then(setLog)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!id || !confirm('Hapus log book entry ini? Stok akan dikembalikan.')) return;
    try {
      await api.delete(`/log-books/${id}`);
      navigate('/log-books');
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <Loading text="Loading log entry..." />;
  if (error) return <ErrorState message={error} />;
  if (!log) return <ErrorState message="Not found" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/log-books')} className="p-2 hover:bg-slate-100 rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Log Book Entry</h1>
        </div>
        <div className="flex items-center gap-2">
          {hasPermission('log_books.update') && (
            <button onClick={() => navigate(`/log-books/${id}/edit`)} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
              <Pencil className="h-4 w-4" />
              Edit
            </button>
          )}
          {hasPermission('log_books.delete') && (
            <button onClick={handleDelete} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors">
              <Trash2 className="h-4 w-4" />
              Hapus
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <div>
              <div className="text-xs text-slate-500">Date</div>
              <div className="font-medium">{formatDate(log.workDate)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-slate-400" />
            <div>
              <div className="text-xs text-slate-500">Activity Type</div>
              <Badge variant="info">{activityTypes[log.items?.[0]?.activityType] || log.items?.[0]?.activityType || '-'}</Badge>
            </div>
          </div>
          {log.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-400" />
              <div>
                <div className="text-xs text-slate-500">Location</div>
                <div className="font-medium">{log.location}</div>
              </div>
            </div>
          )}
          <div>
            <div className="text-xs text-slate-500">Technician</div>
            <div className="font-medium">{log.userName}</div>
          </div>
        </div>

        {log.description && (
          <div>
            <div className="text-xs text-slate-500 mb-1">Description</div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{log.description}</p>
          </div>
        )}
      </div>

      {log.items && log.items.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Work Items ({log.items.length})</h2>
          {log.items.map((item) => (
            <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{item.description}</p>
                </div>
                <Badge variant="info">{activityTypes[item.activityType] || item.activityType}</Badge>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                {item.location && item.location !== log.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{item.location}</span>
                  </div>
                )}
                {item.workOrderNo && (
                  <div>
                    <span className="text-slate-400">WO:</span> {item.workOrderNo}
                  </div>
                )}
                {item.durationMinutes > 0 && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{formatDuration(item.durationMinutes)}</span>
                  </div>
                )}
              </div>
              {item.notes && (() => {
                const { header, checklist } = parseNotes(item.notes);
                return (
                  <div className="mt-2 space-y-2">
                    {header.length > 0 && (
                      <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                        {header.map((line, i) => {
                          const [label, ...rest] = line.split(': ');
                          return (
                            <div key={i} className="text-sm">
                              <span className="font-medium text-slate-700">{label}:</span>{' '}
                              <span className="text-slate-600">{rest.join(': ')}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {checklist.length > 0 && (
                      <div className="bg-blue-50 rounded-lg p-3">
                        <div className="text-xs font-medium text-slate-500 mb-2">Checklist</div>
                        <div className="space-y-1.5">
                          {checklist.map((cl, i) => (
                            <div key={i} className="flex items-center gap-2">
                              {cl.done ? (
                                <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                              )}
                              <span className={`text-sm ${cl.done ? 'text-slate-700' : 'text-slate-500'}`}>
                                {cl.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      {log.spareParts && log.spareParts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">Spare Parts Used ({log.spareParts.length})</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 text-slate-500 font-medium">Code</th>
                <th className="text-left py-2 text-slate-500 font-medium">Item</th>
                <th className="text-right py-2 text-slate-500 font-medium">Qty</th>
                <th className="text-right py-2 text-slate-500 font-medium">Unit Cost</th>
                <th className="text-left py-2 text-slate-500 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {log.spareParts.map((sp) => (
                <tr key={sp.id} className="border-b border-slate-100">
                  <td className="py-2 text-slate-600">{sp.itemCode}</td>
                  <td className="py-2 font-medium">{sp.itemName}</td>
                  <td className="py-2 text-right">{sp.quantity} {sp.unit}</td>
                  <td className="py-2 text-right">Rp {sp.unitCost.toLocaleString()}</td>
                  <td className="py-2 text-slate-500">{sp.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
