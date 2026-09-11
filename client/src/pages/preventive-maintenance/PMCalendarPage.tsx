import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Send,
  CheckSquare,
  X,
  CalendarCheck,
  ClipboardList,
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { PreventiveMaintenance, Asset, User, PaginatedResponse } from '../../api/types';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import Loading from '../../components/ui/Loading';
import Badge from '../../components/ui/Badge';
import { useNotification } from '../../context/NotificationContext';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const frequencyOptions = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'YEARLY', label: 'Yearly' },
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function toDateString(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isOverdue(nextDueDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(nextDueDate) < today;
}

function isSameDay(dateStr1: string, dateStr2: string) {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

interface PmFormData {
  assetId: string;
  title: string;
  description: string;
  frequency: string;
  frequencyValue: string;
  nextDueDate: string;
  assignedTo: string;
}

interface ChecklistForm {
  title: string;
  description: string;
}

const emptyForm: PmFormData = {
  assetId: '',
  title: '',
  description: '',
  frequency: 'MONTHLY',
  frequencyValue: '1',
  nextDueDate: '',
  assignedTo: '',
};

export default function PMCalendarPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = useAuth();
  const { addToast } = useNotification();

  const [pmList, setPmList] = useState<PreventiveMaintenance[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedPm, setSelectedPm] = useState<PreventiveMaintenance | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDayDetail, setShowDayDetail] = useState(false);
  const [formData, setFormData] = useState<PmFormData>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [submittingToLogbook, setSubmittingToLogbook] = useState(false);
  const [pmDetails, setPmDetails] = useState<Map<string, any>>(new Map());
  const [checklistStats, setChecklistStats] = useState<Record<string, { total: number; completed: number }>>({});
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddSearch, setQuickAddSearch] = useState('');
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [formChecklists, setFormChecklists] = useState<ChecklistForm[]>([{ title: '', description: '' }]);
  const [highlightPmId, setHighlightPmId] = useState<string | null>(null);
  const [flashDate, setFlashDate] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const requests: Promise<any>[] = [
        api.get<PaginatedResponse<PreventiveMaintenance>>('/preventive-maintenance?limit=500'),
        api.get<{ data: Asset[] }>('/assets?limit=1000'),
        api.get<Record<string, { total: number; completed: number }>>('/preventive-maintenance/checklist-stats'),
      ];
      if (hasPermission('users.read')) {
        requests.push(api.get<{ data: User[] }>('/users?limit=100'));
      }
      const results = await Promise.all(requests);
      setPmList(results[0].data || []);
      setAssets(results[1].data || []);
      setChecklistStats(results[2] || {});
      if (results[3]) setUsers(results[3].data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [hasPermission]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (loading || pmList.length === 0) return;
    const dateParam = searchParams.get('date');
    if (dateParam) {
      const d = new Date(dateParam);
      setCurrentYear(d.getFullYear());
      setCurrentMonth(d.getMonth());
      setFlashDate(dateParam);
      setTimeout(() => setFlashDate(null), 3000);
    }
    if (dateParam) {
      setSearchParams({}, { replace: true });
    }
  }, [loading, pmList, searchParams, setSearchParams]);

  const pmByDate = useMemo(() => {
    const map = new Map<string, PreventiveMaintenance[]>();
    for (const pm of pmList) {
      if (!pm.nextDueDate) continue;
      const key = new Date(pm.nextDueDate).toISOString().split('T')[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(pm);
    }
    return map;
  }, [pmList]);

  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const days: { date: string; dayNum: number; isCurrentMonth: boolean; isToday: boolean }[] = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth, -i);
      days.push({ date: toDateString(d), dayNum: d.getDate(), isCurrentMonth: false, isToday: false });
    }

    const todayStr = toDateString(new Date());
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(currentYear, currentMonth, i);
      const dateStr = toDateString(d);
      days.push({ date: dateStr, dayNum: i, isCurrentMonth: true, isToday: dateStr === todayStr });
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(currentYear, currentMonth + 1, i);
      days.push({ date: toDateString(d), dayNum: d.getDate(), isCurrentMonth: false, isToday: false });
    }

    return days;
  }, [currentYear, currentMonth]);

  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
  };

  const openDayDetail = async (dateStr: string) => {
    setSelectedDate(dateStr);
    setShowDayDetail(true);
    setPmDetails(new Map());
    const pmsOnDay = pmByDate.get(dateStr) || [];
    const details = new Map<string, any>();
    for (const pm of pmsOnDay) {
      try {
        const detail = await api.get<any>(`/preventive-maintenance/${pm.id}`);
        details.set(String(pm.id), detail);
      } catch {}
    }
    setPmDetails(details);
  };

  const openCreateModal = (date?: string) => {
    setFormData({ ...emptyForm, nextDueDate: date || toDateString(new Date()) });
    setFormChecklists([{ title: '', description: '' }]);
    setFormErrors({});
    setShowCreateModal(true);
  };

  const openEditModal = async (pm: PreventiveMaintenance) => {
    setSelectedPm(pm);
    setFormData({
      assetId: String(pm.assetId),
      title: pm.title,
      description: pm.description || '',
      frequency: pm.frequency,
      frequencyValue: String(pm.frequencyValue || 1),
      nextDueDate: pm.nextDueDate ? new Date(pm.nextDueDate).toISOString().split('T')[0] : '',
      assignedTo: pm.assignedTo ? String(pm.assignedTo) : '',
    });
    try {
      const detail = await api.get<any>(`/preventive-maintenance/${pm.id}`);
      if (detail.checklists && detail.checklists.length > 0) {
        setFormChecklists(detail.checklists.map((c: any) => ({ title: c.title, description: c.description || '' })));
      } else {
        setFormChecklists([{ title: '', description: '' }]);
      }
    } catch {
      setFormChecklists([{ title: '', description: '' }]);
    }
    setFormErrors({});
    setShowEditModal(true);
  };

  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (!formData.assetId) errs.assetId = 'Asset is required';
    if (!formData.title.trim()) errs.title = 'Title is required';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const validChecklists = formChecklists.filter(c => c.title.trim()).map(c => ({
        title: c.title.trim(),
        description: c.description.trim() || undefined,
      }));
      const data = {
        ...formData,
        nextDueDate: formData.nextDueDate || selectedDate || '',
        checklists: validChecklists,
      };
      const result = await api.post<any>('/preventive-maintenance', data);
      addToast('PM schedule created successfully', 'success');
      setShowCreateModal(false);
      await fetchData();
      if (selectedDate && result?.id) {
        const detail = await api.get<any>(`/preventive-maintenance/${result.id}`);
        setPmDetails(prev => {
          const newMap = new Map(prev);
          newMap.set(String(result.id), detail);
          return newMap;
        });
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to create PM', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !selectedPm) return;
    setSubmitting(true);
    try {
      const validChecklists = formChecklists.filter(c => c.title.trim()).map(c => ({
        title: c.title.trim(),
        description: c.description.trim() || undefined,
      }));
      const data = {
        ...formData,
        checklists: validChecklists,
      };
      await api.put(`/preventive-maintenance/${selectedPm.id}`, data);
      addToast('PM schedule updated successfully', 'success');
      setShowEditModal(false);
      setSelectedPm(null);
      await fetchData();
      const detail = await api.get<any>(`/preventive-maintenance/${selectedPm.id}`);
      setPmDetails(prev => {
        const newMap = new Map(prev);
        newMap.set(String(selectedPm.id), detail);
        return newMap;
      });
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to update PM', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (pmId: string) => {
    if (!confirm('Hapus PM dari kalender? (PM tetap tersimpan di daftar PM)')) return;
    setDeletingId(pmId);
    try {
      await api.put(`/preventive-maintenance/${pmId}`, { nextDueDate: null });
      addToast('PM dihapus dari kalender', 'success');
      fetchData();
      if (showDayDetail) {
        const updated = pmList.filter(p => p.id !== pmId);
        if (selectedDate) {
          const remaining = updated.filter(p => isSameDay(p.nextDueDate, selectedDate));
          if (remaining.length === 0) setShowDayDetail(false);
        }
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to remove PM from calendar', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleChecklist = async (checklistId: string, pmId: string) => {
    try {
      const updated = await api.put<any>(`/preventive-maintenance/checklists/${checklistId}/toggle`);
      setPmDetails(prev => {
        const newMap = new Map(prev);
        const detail = newMap.get(pmId);
        if (detail) {
          detail.checklists = detail.checklists.map((c: any) => c.id === checklistId ? updated : c);
          newMap.set(pmId, { ...detail });
        }
        return newMap;
      });
      setChecklistStats(prev => {
        const newStats = { ...prev };
        const stat = newStats[pmId] || { total: 0, completed: 0 };
        const nowCompleted = updated.completed;
        newStats[pmId] = {
          total: stat.total,
          completed: nowCompleted ? stat.completed + 1 : stat.completed - 1,
        };
        return newStats;
      });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSubmitToLogbook = async () => {
    if (!selectedDate) return;
    if (!confirm('Submit all PM activities for this day to Log Book?')) return;
    setSubmittingToLogbook(true);
    try {
      const log = await api.post<any>('/preventive-maintenance/submit-to-logbook', { workDate: selectedDate });
      addToast(`Log Book created: ${log.items?.length || 0} work items recorded`, 'success');
      navigate('/log-books');
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setSubmittingToLogbook(false);
    }
  };

  const dayPms = selectedDate ? pmList.filter(pm => isSameDay(pm.nextDueDate, selectedDate)) : [];

  const getAssetName = (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    return asset ? `${asset.assetCode} - ${asset.assetName}` : '-';
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return '-';
    const user = users.find(u => String(u.id) === String(userId));
    return user ? user.name : '-';
  };

  const getPmCompletion = (pmId: any) => {
    const id = String(pmId);
    const stats = checklistStats[id];
    if (!stats || stats.total === 0) return null;
    return { total: stats.total, completed: stats.completed, done: stats.completed >= stats.total };
  };

  const handleQuickAdd = async (pm: PreventiveMaintenance) => {
    if (!selectedDate) return;
    setQuickAddSaving(true);
    try {
      await api.put(`/preventive-maintenance/${pm.id}`, {
        nextDueDate: selectedDate,
      });
      addToast(`PM "${pm.title}" dijadwalkan ke ${formatDate(selectedDate)}`, 'success');
      setShowQuickAdd(false);
      setQuickAddSearch('');
      await fetchData();
    } catch (err: any) {
      addToast(err.message || 'Failed to reschedule PM', 'error');
    } finally {
      setQuickAddSaving(false);
    }
  };

  const filteredPmList = pmList.filter(pm =>
    pm.title.toLowerCase().includes(quickAddSearch.toLowerCase()) ||
    pm.assetName?.toLowerCase().includes(quickAddSearch.toLowerCase()) ||
    pm.assetCode?.toLowerCase().includes(quickAddSearch.toLowerCase())
  );

  if (loading) return <Loading text="Loading PM calendar..." />;
  if (error) return <div className="text-center py-12 text-red-600">{error}<br /><Button onClick={fetchData} className="mt-4">Retry</Button></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <CalendarCheck className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-900">Preventive Maintenance Calendar</h1>
        </div>
        {hasPermission('preventive_maintenance.create') && (
          <Button onClick={() => openCreateModal()}>
            <Plus className="h-4 w-4" />
            Create PM
          </Button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <button onClick={goToPrevMonth} className="p-2 rounded-lg hover:bg-slate-200 transition-colors">
              <ChevronLeft className="h-5 w-5 text-slate-600" />
            </button>
            <h2 className="text-lg font-semibold text-slate-900 w-48 text-center">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </h2>
            <button onClick={goToNextMonth} className="p-2 rounded-lg hover:bg-slate-200 transition-colors">
              <ChevronRight className="h-5 w-5 text-slate-600" />
            </button>
          </div>
          <Button variant="secondary" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>

        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {DAYS.map(day => (
            <div key={day} className="py-2 text-center text-xs font-semibold text-slate-500 uppercase">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            const dayPms = pmByDate.get(day.date) || [];
            return (
              <div
                key={idx}
                className={`min-h-[100px] border-b border-r border-slate-100 p-1.5 cursor-pointer transition-colors hover:bg-slate-50 ${
                  !day.isCurrentMonth ? 'bg-slate-50/50' : ''
                } ${day.isToday ? 'bg-blue-50' : ''} ${flashDate === day.date ? 'animate-pulse bg-yellow-100 ring-2 ring-yellow-400' : ''}`}
                onClick={() => openDayDetail(day.date)}
              >
                <div className={`text-xs font-medium mb-1 ${
                  day.isToday
                    ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center'
                    : day.isCurrentMonth
                      ? 'text-slate-700'
                      : 'text-slate-400'
                }`}>
                  {day.dayNum}
                </div>
                <div className="space-y-0.5">
                  {dayPms.slice(0, 3).map(pm => {
                    const completion = getPmCompletion(pm.id);
                    return (
                      <div
                        key={pm.id}
                        className={`text-[10px] leading-tight px-1 py-0.5 rounded cursor-pointer ${
                          completion?.done
                            ? 'bg-green-100 text-green-700 border border-green-300'
                            : isOverdue(pm.nextDueDate) && pm.status === 'ACTIVE'
                              ? 'bg-red-100 text-red-700'
                              : pm.frequency === 'DAILY'
                                ? 'bg-blue-100 text-blue-700'
                                : pm.frequency === 'WEEKLY'
                                  ? 'bg-purple-100 text-purple-700'
                                  : pm.frequency === 'MONTHLY'
                                    ? 'bg-green-100 text-green-700'
                                    : pm.frequency === 'QUARTERLY'
                                      ? 'bg-orange-100 text-orange-700'
                                      : 'bg-red-100 text-red-700'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          openDayDetail(day.date);
                        }}
                      >
                        <div className="truncate font-medium">{pm.title}</div>
                        {completion && (
                          <div className="flex items-center gap-1.5 mt-1">
                            {completion.done ? (
                              <CheckSquare className="h-5 w-5 shrink-0 text-green-600" />
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <div className="w-16 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-yellow-500 rounded-full"
                                    style={{ width: `${(completion.completed / completion.total) * 100}%` }}
                                  />
                                </div>
                                <span className="text-xs font-bold text-slate-600">{completion.completed}/{completion.total}</span>
                              </div>
                             )}
                           </div>
                         )}
                       </div>
                     );
                   })}
                   {dayPms.length > 3 && (
                     <div className="text-[10px] text-slate-500 px-1">+{dayPms.length - 3} more</div>
                   )}
                 </div>
               </div>
             );
           })}
         </div>
       </div>

      {showDayDetail && selectedDate && (
        <Modal
          isOpen={showDayDetail}
          onClose={() => setShowDayDetail(false)}
          title={`PM Schedules - ${formatDate(selectedDate)}`}
          size="lg"
        >
          <div className="space-y-4">
            {hasPermission('preventive_maintenance.create') && (
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => setShowQuickAdd(true)}>
                  <ClipboardList className="h-4 w-4" />
                  Quick Add from PM List
                </Button>
                <Button size="sm" onClick={() => openCreateModal(selectedDate)}>
                  <Plus className="h-4 w-4" />
                  Add PM for this day
                </Button>
              </div>
            )}

            {dayPms.length > 0 && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleSubmitToLogbook}
                  disabled={submittingToLogbook}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Send className="h-4 w-4" />
                  {submittingToLogbook ? 'Submitting...' : 'Submit to Logbook'}
                </Button>
              </div>
            )}

            {dayPms.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No PM schedules for this day</p>
            ) : (
              <div className="space-y-3">
                {pmDetails.size === 0 && dayPms.length > 0 && (
                  <div className="text-center py-4 text-sm text-slate-400">Loading checklists...</div>
                )}
                {dayPms.map(pm => {
                  const isHighlighted = highlightPmId === pm.id;
                  return (
                    <div
                      key={pm.id}
                      className={`p-4 rounded-lg border transition-all duration-500 ${
                        isHighlighted
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-300'
                          : isOverdue(pm.nextDueDate) && pm.status === 'ACTIVE'
                            ? 'border-red-200 bg-red-50'
                            : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className="font-medium text-slate-900 hover:text-blue-600 hover:underline cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); navigate(`/preventive-maintenance/${pm.id}`); }}
                            >
                              {pm.title}
                            </span>
                            <Badge variant={pm.frequency}>{pm.frequency}</Badge>
                            <Badge variant={isOverdue(pm.nextDueDate) && pm.status === 'ACTIVE' ? 'ON_HOLD' : pm.status}>
                              {isOverdue(pm.nextDueDate) && pm.status === 'ACTIVE' ? 'OVERDUE' : pm.status}
                            </Badge>
                            {(() => {
                              const c = getPmCompletion(pm.id);
                              if (!c) return null;
                              return c.done ? (
                                <Badge variant="ACTIVE">✓ Done {c.completed}/{c.total}</Badge>
                              ) : (
                                <Badge variant="IN_PROGRESS">{c.completed}/{c.total} checklist</Badge>
                              );
                            })()}
                          </div>
                          <p className="text-sm text-slate-500">Asset: {getAssetName(pm.assetId)}</p>
                          <p className="text-sm text-slate-500">Assigned to: {getUserName(pm.assignedTo)}</p>
                          {pm.description && (
                            <p className="text-sm text-slate-500 mt-1 line-clamp-2">{pm.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {hasPermission('preventive_maintenance.update') && (
                            <button
                              onClick={() => openEditModal(pm)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {hasPermission('preventive_maintenance.delete') && (
                            <button
                              onClick={() => handleDelete(pm.id)}
                              disabled={deletingId === pm.id}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      {pmDetails.get(String(pm.id))?.checklists?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <div className="text-xs font-medium text-slate-500 mb-2">Verification Checklist</div>
                          <div className="space-y-1.5">
                            {pmDetails.get(String(pm.id)).checklists.map((cl: any) => (
                              <label
                                key={cl.id}
                                className="flex items-center gap-2 cursor-pointer group"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={!!cl.completed}
                                  onChange={() => handleToggleChecklist(String(cl.id), String(pm.id))}
                                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className={`text-sm ${cl.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                                  {cl.title}
                                </span>
                                {cl.completed && cl.completedAt && (
                                  <span className="text-[10px] text-slate-400 ml-auto">
                                    {cl.completedByName || getUserName(cl.completedBy)} · {new Date(cl.completedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </label>
                            ))}
                          </div>
                          {(() => {
                            const checklists = pmDetails.get(String(pm.id))?.checklists || [];
                            const completed = checklists.filter((c: any) => c.completed).length;
                            const total = checklists.length;
                            const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                            return (
                              <div className="mt-2 flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-[10px] text-slate-500">{completed}/{total} ({pct}%)</span>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Modal>
      )}

      {(showCreateModal || showEditModal) && (
        <Modal
          isOpen={showCreateModal || showEditModal}
          onClose={() => { setShowCreateModal(false); setShowEditModal(false); setSelectedPm(null); }}
          title={showEditModal ? 'Edit PM Schedule' : 'Create PM Schedule'}
          size="lg"
        >
          <form onSubmit={showEditModal ? handleEdit : handleCreate} className="space-y-4">
            <Select
              label="Asset *"
              options={assets.map(a => ({ value: String(a.id), label: `${a.assetCode} - ${a.assetName}` }))}
              value={formData.assetId}
              onChange={e => setFormData({ ...formData, assetId: e.target.value })}
              error={formErrors.assetId}
              placeholder="Select asset"
            />

            <Input
              label="Title *"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              error={formErrors.title}
              placeholder="PM schedule title"
            />

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Description</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                rows={2}
                placeholder="PM description..."
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700">List Pekerjaan (Checklist)</label>
                <button type="button" onClick={() => setFormChecklists([...formChecklists, { title: '', description: '' }])} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
              {formChecklists.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 bg-slate-50 rounded-lg p-2">
                  <span className="text-xs font-medium text-slate-500 mt-1.5">{idx + 1}.</span>
                  <div className="flex-1 space-y-1">
                    <input type="text" value={item.title} onChange={(e) => { const u = [...formChecklists]; u[idx].title = e.target.value; setFormChecklists(u); }} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" placeholder="Nama pekerjaan..." />
                    <input type="text" value={item.description} onChange={(e) => { const u = [...formChecklists]; u[idx].description = e.target.value; setFormChecklists(u); }} className="w-full border border-slate-300 rounded px-2 py-1 text-xs" placeholder="Deskripsi (opsional)..." />
                  </div>
                  {formChecklists.length > 1 && (
                    <button type="button" onClick={() => setFormChecklists(formChecklists.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                  )}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Frequency"
                options={frequencyOptions}
                value={formData.frequency}
                onChange={e => setFormData({ ...formData, frequency: e.target.value })}
              />
              <Input
                label="Frequency Value"
                type="number"
                value={formData.frequencyValue}
                onChange={e => setFormData({ ...formData, frequencyValue: e.target.value })}
                min="1"
              />
            </div>

            <Input
              label="Next Due Date"
              type="date"
              value={formData.nextDueDate}
              onChange={e => setFormData({ ...formData, nextDueDate: e.target.value })}
              error={formErrors.nextDueDate}
            />

            <Select
              label="Assigned To"
              options={users.map(u => ({ value: String(u.id), label: u.name }))}
              value={formData.assignedTo}
              onChange={e => setFormData({ ...formData, assignedTo: e.target.value })}
              placeholder="Select technician"
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                type="button"
                onClick={() => { setShowCreateModal(false); setShowEditModal(false); setSelectedPm(null); }}
              >
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                {showEditModal ? 'Update PM Schedule' : 'Create PM Schedule'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {showQuickAdd && (
        <Modal
          isOpen={showQuickAdd}
          onClose={() => { setShowQuickAdd(false); setQuickAddSearch(''); }}
          title={`Quick Add PM to ${selectedDate ? formatDate(selectedDate) : ''}`}
          size="lg"
        >
          <div className="space-y-3">
            <input
              type="text"
              value={quickAddSearch}
              onChange={(e) => setQuickAddSearch(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Search PM by title or asset..."
              autoFocus
            />
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {filteredPmList.length === 0 ? (
                <p className="text-center text-slate-500 py-6 text-sm">No PM schedules found</p>
              ) : (
                filteredPmList.map(pm => (
                  <button
                    key={pm.id}
                    onClick={() => handleQuickAdd(pm)}
                    disabled={quickAddSaving}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-slate-900 truncate">{pm.title}</div>
                        <div className="text-xs text-slate-500">
                          {pm.assetCode} - {pm.assetName} | {pm.frequency}
                          {pm.assignedToName ? ` | ${pm.assignedToName}` : ''}
                        </div>
                      </div>
                      <Plus className="h-4 w-4 text-slate-400 shrink-0 ml-2" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
