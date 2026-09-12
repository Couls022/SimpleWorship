import { withPortal } from './common/withPortal';
import React, { useState, useEffect } from 'react';
import { 
  X, 
  Bell, 
  Play, 
  Power, 
  AlertTriangle, 
  Check, 
  Clock, 
  Tv, 
  Palette, 
  Volume2, 
  Sparkles, 
  ShieldAlert,
  Send,
  Trash2,
  Plus,
  Edit2,
  Bookmark,
  RotateCcw,
  Sliders,
  ChevronDown,
  ChevronUp,
  Baby,
  Layers,
  CheckCircle2,
  Copy
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { AlertPreset } from '../types';

interface AlertModalProps {
  onClose: () => void;
}

function AlertModal({ onClose }: AlertModalProps) {
  const store = useStore();
  const { 
    alert: globalAlert, 
    groupAlerts, 
    setAlert, 
    activeControlGroupId, 
    outputGroups,
    alertPresets = [],
    addAlertPreset,
    updateAlertPreset,
    deleteAlertPreset,
    resetAlertPresets
  } = store;
  
  const currentActiveGroup = activeControlGroupId || outputGroups[0]?.id || 'group-congregation';
  const alert = (currentActiveGroup && groupAlerts[currentActiveGroup]) || globalAlert;

  const [message, setMessage] = useState(alert.message || 'Nursery #304 is requested in the Toddler Room');
  const [position, setPosition] = useState<'bottom' | 'top'>(alert.position || 'bottom');
  const [bgColor, setBgColor] = useState(alert.backgroundColor || '#0F172A');
  const [textColor, setTextColor] = useState(alert.textColor || '#FACC15');
  const [showNurseryBadge, setShowNurseryBadge] = useState(alert.showNursery || false);
  const [nurseryCode, setNurseryCode] = useState(alert.nurseryText || '#304');
  const [autoDismissSecs, setAutoDismissSecs] = useState<number>(0); // 0 = continuous
  const [targetGroup, setTargetGroup] = useState<string>('all');
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  // Preset Management State (Create / Edit / Delete)
  const [isCreatingPreset, setIsCreatingPreset] = useState(false);
  const [newPresetTitle, setNewPresetTitle] = useState('');
  
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    title: string;
    message: string;
    position: 'bottom' | 'top';
    backgroundColor: string;
    textColor: string;
    showNursery: boolean;
    nurseryText: string;
    autoDismissSecs: number;
    targetGroup: string;
  }>({
    title: '',
    message: '',
    position: 'bottom',
    backgroundColor: '#0F172A',
    textColor: '#FACC15',
    showNursery: false,
    nurseryText: '',
    autoDismissSecs: 0,
    targetGroup: 'all'
  });

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Sync back to backend REST API on change
  const dispatchAlertToBackend = (alertState: any) => {
    try {
      fetch('/api/remote/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: alertState.active ? 'set_alert' : 'clear_alert',
          params: alertState
        })
      }).catch(() => {});
    } catch (e) {
      // Offline fallback
    }
  };

  const handleToggleActive = () => {
    const nextActive = !alert.active;
    const alertData = {
      active: nextActive,
      message: message.trim(),
      position,
      backgroundColor: bgColor,
      textColor,
      showNursery: showNurseryBadge,
      nurseryText: nurseryCode.trim(),
    };

    if (targetGroup === 'all') {
      setAlert(alertData);
    } else {
      setAlert(alertData, targetGroup);
    }

    dispatchAlertToBackend(alertData);

    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', {
        detail: nextActive ? 'Alert Broadcast STARTED' : 'Alert Broadcast STOPPED'
      })
    );
  };

  const handleSaveAndBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    const alertData = {
      message: message.trim(),
      position,
      backgroundColor: bgColor,
      textColor,
      active: true,
      showNursery: showNurseryBadge,
      nurseryText: nurseryCode.trim(),
    };

    if (targetGroup === 'all') {
      setAlert(alertData);
    } else {
      setAlert(alertData, targetGroup);
    }

    dispatchAlertToBackend(alertData);

    // If auto-dismiss timer is configured, schedule clear
    if (autoDismissSecs > 0) {
      setTimeout(() => {
        const clearData = { active: false };
        if (targetGroup === 'all') {
          setAlert(clearData);
        } else {
          setAlert(clearData, targetGroup);
        }
        dispatchAlertToBackend(clearData);
      }, autoDismissSecs * 1000);
    }

    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', {
        detail: 'Alert successfully broadcasted to live screens!'
      })
    );
    onClose();
  };

  const handleClearAlert = () => {
    const clearData = { active: false, showNursery: false };
    if (targetGroup === 'all') {
      setAlert(clearData);
    } else {
      setAlert(clearData, targetGroup);
    }
    dispatchAlertToBackend(clearData);
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', {
        detail: 'Live alert cleared from all screens.'
      })
    );
  };

  // --- PRESET ACTIONS (LOAD, SAVE, EDIT, DELETE, RESET) ---
  const handleLoadPreset = (preset: AlertPreset) => {
    setMessage(preset.message || '');
    if (preset.position) setPosition(preset.position);
    if (preset.backgroundColor) setBgColor(preset.backgroundColor);
    if (preset.textColor) setTextColor(preset.textColor);
    if (preset.showNursery !== undefined) setShowNurseryBadge(preset.showNursery);
    if (preset.nurseryText !== undefined) setNurseryCode(preset.nurseryText);
    if (preset.autoDismissSecs !== undefined) setAutoDismissSecs(preset.autoDismissSecs);
    if (preset.targetGroup) setTargetGroup(preset.targetGroup);
    
    setActivePresetId(preset.id);
    setEditingPresetId(null);
    setIsCreatingPreset(false);

    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', {
        detail: `Loaded preset: "${preset.title || preset.message.slice(0, 24)}"`
      })
    );
  };

  const handleStartCreatePreset = () => {
    setIsCreatingPreset(true);
    setNewPresetTitle(message ? (message.length > 25 ? message.slice(0, 25) + '...' : message) : 'New Alert Preset');
    setEditingPresetId(null);
  };

  const handleSaveNewPreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const created = addAlertPreset({
      title: newPresetTitle.trim() || message.trim().slice(0, 25),
      message: message.trim(),
      position,
      backgroundColor: bgColor,
      textColor,
      showNursery: showNurseryBadge,
      nurseryText: nurseryCode.trim(),
      targetGroup,
      autoDismissSecs,
    });

    setActivePresetId(created.id);
    setIsCreatingPreset(false);
    setNewPresetTitle('');

    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', {
        detail: `Saved new preset: "${created.title}"`
      })
    );
  };

  const handleStartEditPreset = (preset: AlertPreset, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPresetId(preset.id);
    setIsCreatingPreset(false);
    setDeleteConfirmId(null);
    setEditForm({
      title: preset.title || '',
      message: preset.message || '',
      position: preset.position || 'bottom',
      backgroundColor: preset.backgroundColor || '#0F172A',
      textColor: preset.textColor || '#FACC15',
      showNursery: preset.showNursery || false,
      nurseryText: preset.nurseryText || '',
      autoDismissSecs: preset.autoDismissSecs || 0,
      targetGroup: preset.targetGroup || 'all'
    });
  };

  const handleSaveEditedPreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPresetId) return;

    updateAlertPreset(editingPresetId, {
      title: editForm.title.trim() || editForm.message.slice(0, 25),
      message: editForm.message.trim(),
      position: editForm.position,
      backgroundColor: editForm.backgroundColor,
      textColor: editForm.textColor,
      showNursery: editForm.showNursery,
      nurseryText: editForm.nurseryText.trim(),
      autoDismissSecs: editForm.autoDismissSecs,
      targetGroup: editForm.targetGroup,
    });

    // Also update current active fields if the edited preset is active
    if (activePresetId === editingPresetId) {
      setMessage(editForm.message);
      setPosition(editForm.position);
      setBgColor(editForm.backgroundColor);
      setTextColor(editForm.textColor);
      setShowNurseryBadge(editForm.showNursery);
      setNurseryCode(editForm.nurseryText);
      setAutoDismissSecs(editForm.autoDismissSecs);
      setTargetGroup(editForm.targetGroup);
    }

    setEditingPresetId(null);
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', {
        detail: 'Preset successfully updated!'
      })
    );
  };

  const handleCopyCurrentToEditForm = () => {
    setEditForm({
      ...editForm,
      message,
      position,
      backgroundColor: bgColor,
      textColor,
      showNursery: showNurseryBadge,
      nurseryText: nurseryCode,
      autoDismissSecs,
      targetGroup
    });
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', {
        detail: 'Copied current settings into preset editor.'
      })
    );
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteAlertPreset(id);
    if (activePresetId === id) setActivePresetId(null);
    if (editingPresetId === id) setEditingPresetId(null);
    setDeleteConfirmId(null);

    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', {
        detail: 'Alert preset deleted.'
      })
    );
  };

  const handleResetDefaults = () => {
    if (window.confirm('Reset all alert presets to system defaults?')) {
      resetAlertPresets();
      setActivePresetId(null);
      setEditingPresetId(null);
      setIsCreatingPreset(false);
      window.dispatchEvent(
        new CustomEvent('simpleworship:notify', {
          detail: 'Alert presets restored to default.'
        })
      );
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div 
        className="bg-[#1b1e27] border border-[#2d3242] rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden text-gray-200 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#232733] border-b border-[#1c202a] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Bell size={17} className={alert.active ? 'animate-bounce' : ''} />
            </div>
            <div>
              <h2 className="font-bold text-sm text-gray-100 flex items-center gap-2">
                <span>Live Screen Message & Nursery Alert</span>
                {alert.active && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-black font-black text-[10px] tracking-wider animate-pulse">
                    BROADCASTING
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-gray-400">Display marquee tickers and nursery parent summons across congregation screens</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-[#343a4a] transition-colors cursor-pointer"
          >
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1 custom-scrollbar">
          {/* Active Banner Status Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#13151b] border border-[#2a2e3d]">
            <div className="flex items-center gap-3">
              <span className={`w-3 h-3 rounded-full ${alert.active ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)] animate-ping' : 'bg-gray-600'}`}></span>
              <div>
                <div className="font-bold text-gray-100 text-xs">Alert Overlay Status</div>
                <div className="text-[11px] text-gray-400">
                  {alert.active ? 'Currently BROADCASTING to live screens' : 'Disabled / Hidden'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {alert.active && (
                <button
                  type="button"
                  onClick={handleClearAlert}
                  className="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Clear Alert"
                >
                  <Trash2 size={13} />
                  <span>Clear</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleToggleActive}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 ${
                  alert.active
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {alert.active ? 'Stop Alert' : 'Start Alert'}
              </button>
            </div>
          </div>

          {/* QUICK PRESETS SECTION WITH REAL SAVE, EDIT, DELETE, RESET */}
          <div className="bg-[#141720] border border-[#282d3c] rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Bookmark size={13} className="text-amber-400" />
                <label className="text-gray-300 font-bold text-[11px] uppercase tracking-wider">
                  Quick Presets ({alertPresets.length})
                </label>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleStartCreatePreset}
                  className="px-2.5 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 hover:text-amber-200 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Save current message and settings as a new preset"
                >
                  <Plus size={12} />
                  <span>Save Current as Preset</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="p-1 rounded bg-[#202430] hover:bg-[#2b3040] text-gray-400 hover:text-gray-200 text-[11px] transition-colors cursor-pointer"
                  title="Restore default system presets"
                >
                  <RotateCcw size={12} />
                </button>
              </div>
            </div>

            {/* Inline Create Preset Form */}
            {isCreatingPreset && (
              <form onSubmit={handleSaveNewPreset} className="p-3 bg-[#1c202d] border border-amber-500/40 rounded-lg space-y-2 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-amber-400 flex items-center gap-1">
                    <Plus size={13} />
                    Save Current Alert as New Preset
                  </span>
                  <button 
                    type="button" 
                    onClick={() => setIsCreatingPreset(false)} 
                    className="text-gray-400 hover:text-white p-0.5 rounded cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 font-semibold block mb-0.5">Preset Name / Label:</label>
                  <input
                    type="text"
                    required
                    value={newPresetTitle}
                    onChange={(e) => setNewPresetTitle(e.target.value)}
                    placeholder="e.g. Nursery Parent Notice #304"
                    className="w-full bg-[#11131a] border border-[#373c4e] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                    autoFocus
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-gray-400">
                    Will save message: <strong className="text-gray-200 font-medium truncate max-w-[200px] inline-block align-bottom">{message || '(empty)'}</strong>
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCreatingPreset(false)}
                      className="px-2.5 py-1 rounded bg-[#2b3040] hover:bg-[#383f52] text-gray-300 text-[11px] font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                    >
                      <Check size={12} />
                      Save Preset
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Presets List */}
            <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-0.5 custom-scrollbar">
              {alertPresets.map((preset) => {
                const isSelected = activePresetId === preset.id || message === preset.message;
                const isEditing = editingPresetId === preset.id;
                const isConfirmingDelete = deleteConfirmId === preset.id;

                if (isEditing) {
                  return (
                    <form 
                      key={preset.id} 
                      onSubmit={handleSaveEditedPreset}
                      className="p-3 bg-[#1e2330] border border-amber-500/50 rounded-lg space-y-2.5 text-xs animate-in fade-in"
                    >
                      <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                        <span className="font-bold text-amber-400 flex items-center gap-1.5 text-[11px]">
                          <Edit2 size={12} />
                          Edit Preset: {preset.title || preset.message.slice(0, 20)}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyCurrentToEditForm}
                          className="px-2 py-0.5 bg-[#2a3040] hover:bg-[#363e52] text-amber-300 text-[10px] rounded flex items-center gap-1 cursor-pointer"
                          title="Fill editor with current settings from the form below"
                        >
                          <Copy size={11} />
                          <span>Copy Current Form</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-gray-400 font-semibold block mb-0.5">Preset Title / Label:</label>
                          <input
                            type="text"
                            required
                            value={editForm.title}
                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                            placeholder="Preset Title"
                            className="w-full bg-[#11131a] border border-[#373c4e] rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 font-semibold block mb-0.5">Position & Timer:</label>
                          <div className="grid grid-cols-2 gap-1">
                            <select
                              value={editForm.position}
                              onChange={(e) => setEditForm({ ...editForm, position: e.target.value as any })}
                              className="bg-[#11131a] border border-[#373c4e] rounded px-1.5 py-1 text-xs text-white"
                            >
                              <option value="bottom">Bottom</option>
                              <option value="top">Top</option>
                            </select>
                            <select
                              value={editForm.autoDismissSecs}
                              onChange={(e) => setEditForm({ ...editForm, autoDismissSecs: Number(e.target.value) })}
                              className="bg-[#11131a] border border-[#373c4e] rounded px-1.5 py-1 text-xs text-white"
                            >
                              <option value={0}>Continuous</option>
                              <option value={10}>10s</option>
                              <option value={30}>30s</option>
                              <option value={60}>60s</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-gray-400 font-semibold block mb-0.5">Message Text:</label>
                        <input
                          type="text"
                          required
                          value={editForm.message}
                          onChange={(e) => setEditForm({ ...editForm, message: e.target.value })}
                          placeholder="Alert Message Text..."
                          className="w-full bg-[#11131a] border border-[#373c4e] rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      {/* Colors in Edit Form */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1 text-[11px] text-gray-300">
                            <span>Text:</span>
                            <input
                              type="color"
                              value={editForm.textColor}
                              onChange={(e) => setEditForm({ ...editForm, textColor: e.target.value })}
                              className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                            />
                          </label>
                          <label className="flex items-center gap-1 text-[11px] text-gray-300">
                            <span>BG:</span>
                            <input
                              type="color"
                              value={editForm.backgroundColor.startsWith('#') ? editForm.backgroundColor : '#0F172A'}
                              onChange={(e) => setEditForm({ ...editForm, backgroundColor: e.target.value })}
                              className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                            />
                          </label>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingPresetId(null)}
                            className="px-2.5 py-1 rounded bg-[#2b3040] hover:bg-[#383f52] text-gray-300 text-[11px] font-medium cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Check size={12} />
                            Save Changes
                          </button>
                        </div>
                      </div>
                    </form>
                  );
                }

                return (
                  <div
                    key={preset.id}
                    onClick={() => handleLoadPreset(preset)}
                    className={`group relative flex items-center justify-between px-3 py-2 rounded-lg text-[11px] border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#272d3d] border-amber-500/60 shadow-sm'
                        : 'bg-[#1b1f2b] hover:bg-[#232938] border-white/5 hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                      <span 
                        className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0 shadow-xs" 
                        style={{ backgroundColor: preset.backgroundColor || '#0F172A' }}
                        title={`Colors: Text ${preset.textColor || '#FACC15'} / BG ${preset.backgroundColor || '#0F172A'}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-semibold truncate ${isSelected ? 'text-amber-300' : 'text-gray-200'}`}>
                            {preset.title || preset.message}
                          </span>
                          {isSelected && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold shrink-0">
                              Active
                            </span>
                          )}
                        </div>
                        {preset.title && preset.title !== preset.message && (
                          <div className="text-[10px] text-gray-400 truncate">
                            {preset.message}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action buttons (Edit & Delete) */}
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1 animate-in fade-in">
                          <button
                            type="button"
                            onClick={(e) => handleDeletePreset(preset.id, e)}
                            className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] cursor-pointer"
                          >
                            Confirm Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="p-1 text-gray-400 hover:text-white rounded cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={(e) => handleStartEditPreset(preset, e)}
                            className="p-1.5 rounded-md hover:bg-[#343b4e] text-gray-400 hover:text-amber-300 transition-colors cursor-pointer"
                            title="Edit this preset"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(preset.id);
                            }}
                            className="p-1.5 rounded-md hover:bg-rose-950/40 text-gray-400 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Delete this preset"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {alertPresets.length === 0 && (
                <div className="py-5 px-4 text-center text-gray-500 text-xs border border-dashed border-[#282c37] rounded-lg bg-[#14161d]/50">
                  Walang naka-save na preset. Mag-type ng message sa ibaba at i-click ang <span className="text-amber-400 font-semibold">"+ Save Current as Preset"</span> upang mag-add manually.
                </div>
              )}
            </div>
          </div>

          {/* Form for Active Alert Configuration */}
          <form id="alert-main-form" onSubmit={handleSaveAndBroadcast} className="space-y-4">
            {/* Alert Message Text */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-gray-300 font-bold text-[11px]">
                  Message Text *
                </label>
                <button
                  type="button"
                  onClick={handleStartCreatePreset}
                  className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Bookmark size={11} />
                  <span>Bookmark as Preset</span>
                </button>
              </div>
              <input
                type="text"
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. Nursery #304 is requested in the Toddler Room..."
                className="w-full bg-[#13151b] border border-[#2f3444] rounded-lg px-3.5 py-2 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 font-medium"
              />
            </div>

            {/* Nursery Call Badge Option */}
            <div className="p-3 bg-[#141720] border border-[#292e3e] rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400">
                  <Baby size={16} />
                </div>
                <div>
                  <div className="font-semibold text-xs text-gray-200">Nursery Parent Summon Tag</div>
                  <div className="text-[10px] text-gray-400">Include a parent code tag badge (e.g. #304) on screen</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {showNurseryBadge && (
                  <input
                    type="text"
                    value={nurseryCode}
                    onChange={(e) => setNurseryCode(e.target.value)}
                    placeholder="#304"
                    className="w-20 bg-[#0f1117] border border-[#3b4154] rounded px-2 py-1 text-xs text-amber-300 font-bold text-center"
                  />
                )}
                <button
                  type="button"
                  onClick={() => setShowNurseryBadge(!showNurseryBadge)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                    showNurseryBadge
                      ? 'bg-amber-500 text-black'
                      : 'bg-[#272b38] text-gray-400 hover:text-white'
                  }`}
                >
                  {showNurseryBadge ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>

            {/* Position & Colors */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-gray-400 block mb-1 font-semibold text-[11px]">Position</label>
                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value as any)}
                  className="w-full bg-[#13151b] border border-[#2f3444] rounded-lg px-2.5 py-1.5 text-xs text-gray-200 cursor-pointer"
                >
                  <option value="bottom">Bottom Screen</option>
                  <option value="top">Top Screen</option>
                </select>
              </div>

              <div>
                <label className="text-gray-400 block mb-1 font-semibold text-[11px]">Text Color</label>
                <div className="flex items-center gap-2 bg-[#13151b] border border-[#2f3444] rounded-lg p-1">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-7 h-6 bg-transparent cursor-pointer rounded border-0"
                  />
                  <span className="text-[11px] font-mono text-gray-300">{textColor}</span>
                </div>
              </div>

              <div>
                <label className="text-gray-400 block mb-1 font-semibold text-[11px]">Background</label>
                <div className="flex items-center gap-2 bg-[#13151b] border border-[#2f3444] rounded-lg p-1">
                  <input
                    type="color"
                    value={bgColor.startsWith('#') ? bgColor : '#0F172A'}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-7 h-6 bg-transparent cursor-pointer rounded border-0"
                  />
                  <span className="text-[11px] font-mono text-gray-300">{bgColor}</span>
                </div>
              </div>
            </div>

            {/* Target Screens & Auto Dismiss Options */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-gray-400 block mb-1 font-semibold text-[11px]">Target Screens</label>
                <select
                  value={targetGroup}
                  onChange={(e) => setTargetGroup(e.target.value)}
                  className="w-full bg-[#13151b] border border-[#2f3444] rounded-lg px-2.5 py-1.5 text-xs text-gray-200 cursor-pointer"
                >
                  <option value="all">All Output Screens</option>
                  {outputGroups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-gray-400 block mb-1 font-semibold text-[11px]">Auto Dismiss Timer</label>
                <select
                  value={autoDismissSecs}
                  onChange={(e) => setAutoDismissSecs(Number(e.target.value))}
                  className="w-full bg-[#13151b] border border-[#2f3444] rounded-lg px-2.5 py-1.5 text-xs text-gray-200 cursor-pointer"
                >
                  <option value={0}>Continuous (Manual Stop)</option>
                  <option value={10}>10 Seconds</option>
                  <option value={30}>30 Seconds</option>
                  <option value={60}>60 Seconds (1 Min)</option>
                  <option value={120}>2 Minutes</option>
                </select>
              </div>
            </div>

            {/* Live Marquee Preview */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-gray-400 font-semibold text-[11px] uppercase tracking-wider">
                  Live Ticker Preview
                </label>
                <span className="text-[10px] text-gray-400">Position: <strong className="text-amber-400 uppercase">{position}</strong></span>
              </div>
              <div
                className="p-2.5 rounded-xl border border-amber-500/40 overflow-hidden text-xs font-bold flex items-center gap-2.5 shadow-md transition-all"
                style={{ backgroundColor: bgColor, color: textColor }}
              >
                <span className="px-2 py-0.5 rounded bg-amber-500 text-black text-[10px] font-black uppercase tracking-wider shrink-0">
                  ALERT
                </span>
                {showNurseryBadge && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 text-[10px] font-mono font-bold border border-amber-400/30 shrink-0">
                    {nurseryCode || '#NURSERY'}
                  </span>
                )}
                <span className="truncate font-sans text-sm">{message || 'No alert text entered'}</span>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#202431] border-t border-[#262b3a] flex items-center justify-between shrink-0">
          <span className="text-[10px] text-gray-400 hidden sm:inline">
            Broadcasts in real-time across HDMI, NDI, and secondary monitors.
          </span>
          <div className="flex items-center space-x-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#272b38] hover:bg-[#343a4b] text-gray-300 font-semibold transition-colors cursor-pointer text-xs"
            >
              Close
            </button>
            <button
              type="submit"
              form="alert-main-form"
              className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer text-xs"
            >
              <Send size={13} />
              <span>Broadcast Alert</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default withPortal(AlertModal);

