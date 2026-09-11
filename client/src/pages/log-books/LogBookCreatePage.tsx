import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { SparePart, PaginatedResponse, LogBook } from '../../api/types';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Loading from '../../components/ui/Loading';

const activityOptions = [
  { value: 'CORRECTIVE', label: 'Corrective Maintenance' },
  { value: 'PREVENTIVE', label: 'Preventive Maintenance' },
  { value: 'INSPECTION', label: 'Inspection' },
  { value: 'EMERGENCY', label: 'Emergency Repair' },
];

interface SparePartEntry {
  sparePartId: string;
  itemName: string;
  itemCode: string;
  unit: string;
  currentStock: number;
  quantity: number;
  unitCost: number;
  notes: string;
}

interface WorkItemEntry {
  description: string;
  activityType: string;
  location: string;
  workOrderNo: string;
  durationMinutes: number;
  notes: string;
  spareParts: SparePartEntry[];
  partSearch: string;
}

function createEmptyItem(): WorkItemEntry {
  return {
    description: '',
    activityType: 'CORRECTIVE',
    location: '',
    workOrderNo: '',
    durationMinutes: 0,
    notes: '',
    spareParts: [],
    partSearch: '',
  };
}

export default function LogBookCreatePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);
  const [loadingParts, setLoadingParts] = useState(true);
  const [sparePartsList, setSparePartsList] = useState<SparePart[]>([]);

  const [workDate, setWorkDate] = useState(new Date().toISOString().split('T')[0]);
  const [parentLocation, setParentLocation] = useState('');
  const [items, setItems] = useState<WorkItemEntry[]>([createEmptyItem()]);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const partsRes = await api.get<PaginatedResponse<SparePart>>('/spare-parts?limit=200');
        setSparePartsList(partsRes.data);
      } catch {}

      if (isEdit && id) {
        try {
          const log = await api.get<LogBook>(`/log-books/${id}`);
          setWorkDate(log.workDate?.split('T')[0] || new Date().toISOString().split('T')[0]);
          setParentLocation(log.location || '');
          if (log.items && log.items.length > 0) {
            setItems(log.items.map((item: any) => ({
              description: item.description || '',
              activityType: item.activityType || 'CORRECTIVE',
              location: item.location || '',
              workOrderNo: item.workOrderNo || '',
              durationMinutes: item.durationMinutes || 0,
              notes: item.notes || '',
              spareParts: (log.spareParts || []).map((sp: any) => ({
                sparePartId: sp.sparePartId || sp.id,
                itemName: sp.itemName,
                itemCode: sp.itemCode,
                unit: sp.unit || 'PCS',
                currentStock: sp.currentStock || 0,
                quantity: sp.quantity || 1,
                unitCost: sp.unitCost || 0,
                notes: sp.notes || '',
              })),
              partSearch: '',
            })));
          }
        } catch (err: any) {
          alert('Failed to load log entry: ' + err.message);
          navigate('/log-books');
        }
      }
      setLoadingParts(false);
      setLoadingData(false);
    };
    loadAll();
  }, [id, isEdit]);

  const getFilteredParts = (search: string, excludeIds: string[]) => {
    return sparePartsList.filter(
      (sp) =>
        (sp.itemName?.toLowerCase().includes(search.toLowerCase()) ||
         sp.itemCode?.toLowerCase().includes(search.toLowerCase())) &&
        !excludeIds.includes(sp.id)
    );
  };

  const addItem = () => {
    setItems([...items, createEmptyItem()]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof WorkItemEntry, value: any) => {
    const updated = [...items];
    (updated[index] as any)[field] = value;
    setItems(updated);
  };

  const addPartToItem = (itemIndex: number, sp: SparePart) => {
    const updated = [...items];
    updated[itemIndex].spareParts.push({
      sparePartId: sp.id,
      itemName: sp.itemName,
      itemCode: sp.itemCode,
      unit: sp.unit || 'PCS',
      currentStock: sp.currentStock || 0,
      quantity: 1,
      unitCost: sp.unitCost || 0,
      notes: '',
    });
    updated[itemIndex].partSearch = '';
    setItems(updated);
  };

  const removePartFromItem = (itemIndex: number, partIndex: number) => {
    const updated = [...items];
    updated[itemIndex].spareParts.splice(partIndex, 1);
    setItems(updated);
  };

  const updatePartInItem = (itemIndex: number, partIndex: number, field: string, value: any) => {
    const updated = [...items];
    (updated[itemIndex].spareParts[partIndex] as any)[field] = value;
    setItems(updated);
  };

  const handleSubmit = async () => {
    if (!workDate) { alert('Work date is required'); return; }
    if (items.length === 0) { alert('At least one work item is required'); return; }

    for (let i = 0; i < items.length; i++) {
      if (!items[i].description.trim()) {
        alert(`Work item ${i + 1}: Description is required`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        workDate,
        location: parentLocation,
        description: items[0]?.description || '',
        items: items.map((item) => ({
          description: item.description,
          activityType: item.activityType,
          location: item.location || parentLocation,
          workOrderNo: item.workOrderNo,
          durationMinutes: item.durationMinutes,
          notes: item.notes,
          spareParts: item.spareParts.map((p) => ({
            sparePartId: p.sparePartId,
            quantity: p.quantity,
            unitCost: p.unitCost,
            notes: p.notes,
          })),
        })),
      };

      if (isEdit && id) {
        await api.put(`/log-books/${id}`, payload);
      } else {
        await api.post('/log-books', payload);
      }
      navigate('/log-books');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loadingData) return <Loading text="Loading log entry..." />;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/log-books')} className="p-2 hover:bg-slate-100 rounded-lg">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-slate-900">{isEdit ? 'Edit Log Book Entry' : 'New Log Book Entry'}</h1>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Work Date *"
            type="date"
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
          />
          <Input
            label="Location (default for all items)"
            value={parentLocation}
            onChange={(e) => setParentLocation(e.target.value)}
            placeholder="e.g. Building A, Floor 2"
          />
        </div>
      </div>

      {items.map((item, itemIndex) => {
        const excludeIds = item.spareParts.map((p) => p.sparePartId);
        const filteredParts = item.partSearch ? getFilteredParts(item.partSearch, excludeIds) : [];

        return (
          <div key={itemIndex} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Work Item {items.length > 1 ? `#${itemIndex + 1}` : ''}
              </h2>
              {items.length > 1 && (
                <button
                  onClick={() => removeItem(itemIndex)}
                  className="p-1 text-slate-400 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
                <textarea
                  value={item.description}
                  onChange={(e) => updateItem(itemIndex, 'description', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                  placeholder="Describe the work performed..."
                />
              </div>
              <Select
                label="Activity Type"
                options={activityOptions}
                value={item.activityType}
                onChange={(e) => updateItem(itemIndex, 'activityType', e.target.value)}
              />
              <Input
                label="Location (overrides default)"
                value={item.location}
                onChange={(e) => updateItem(itemIndex, 'location', e.target.value)}
                placeholder="Override location for this item"
              />
              <Input
                label="Work Order No."
                value={item.workOrderNo}
                onChange={(e) => updateItem(itemIndex, 'workOrderNo', e.target.value)}
                placeholder="e.g. WO-2026-000001"
              />
              <Input
                label="Duration (minutes)"
                type="number"
                value={item.durationMinutes || ''}
                onChange={(e) => updateItem(itemIndex, 'durationMinutes', Number(e.target.value))}
                min={0}
                placeholder="e.g. 45"
              />
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={item.notes}
                  onChange={(e) => updateItem(itemIndex, 'notes', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Additional notes..."
                />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-3">
              <h3 className="text-sm font-medium text-slate-700">Spare Parts Used</h3>

              {item.spareParts.length > 0 && (
                <div className="space-y-2">
                  {item.spareParts.map((part, partIndex) => (
                    <div key={partIndex} className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{part.itemName}</div>
                        <div className="text-xs text-slate-500">{part.itemCode} | Stock: {part.currentStock} {part.unit}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={part.quantity}
                          onChange={(e) => updatePartInItem(itemIndex, partIndex, 'quantity', Number(e.target.value))}
                          min={1}
                          max={part.currentStock}
                          className="w-20 border border-slate-300 rounded px-2 py-1 text-sm text-center"
                        />
                        <input
                          type="number"
                          value={part.unitCost}
                          onChange={(e) => updatePartInItem(itemIndex, partIndex, 'unitCost', Number(e.target.value))}
                          min={0}
                          className="w-24 border border-slate-300 rounded px-2 py-1 text-sm text-center"
                          placeholder="Cost"
                        />
                        <input
                          type="text"
                          value={part.notes}
                          onChange={(e) => updatePartInItem(itemIndex, partIndex, 'notes', e.target.value)}
                          className="w-32 border border-slate-300 rounded px-2 py-1 text-sm"
                          placeholder="Notes"
                        />
                        <button onClick={() => removePartFromItem(itemIndex, partIndex)} className="p-1 text-slate-400 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {loadingParts ? (
                <Loading text="Loading spare parts..." />
              ) : (
                <div>
                  <input
                    type="text"
                    value={item.partSearch}
                    onChange={(e) => updateItem(itemIndex, 'partSearch', e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="Search spare parts to add..."
                  />
                  {item.partSearch && filteredParts.length > 0 && (
                    <div className="mt-1 border border-slate-200 rounded-lg max-h-48 overflow-y-auto bg-white shadow-sm">
                      {filteredParts.slice(0, 10).map((sp) => (
                        <button
                          key={sp.id}
                          onClick={() => addPartToItem(itemIndex, sp)}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm flex justify-between items-center"
                        >
                          <span>{sp.itemCode} - {sp.itemName}</span>
                          <span className="text-slate-500">Stock: {sp.currentStock} {sp.unit}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      <button
        onClick={addItem}
        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        <Plus className="h-4 w-4" />
        Add Another Work Item
      </button>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => navigate('/log-books')}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : isEdit ? 'Update Entry' : 'Save Entry'}
        </Button>
      </div>
    </div>
  );
}
