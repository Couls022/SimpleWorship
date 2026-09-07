import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  Download, 
  Upload, 
  Copy, 
  FolderArchive,
  Info,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { v4 as uuidv4 } from 'uuid';
import { 
  exportPortableProfile, 
  downloadPortableProfilePackage, 
  parsePortableProfilePackage, 
  importPortableProfileToDatabase 
} from '../utils/profileManager';

interface ProfilesManagerModalProps {
  onClose: () => void;
  initialCreateOpen?: boolean;
}

export default function ProfilesManagerModal({ onClose, initialCreateOpen = false }: ProfilesManagerModalProps) {
  const { 
    profiles, 
    activeProfileId, 
    addProfile, 
    updateProfile, 
    removeProfile, 
    setActiveProfile,
    activeSchedule,
    shortcutSettings
  } = useStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(initialCreateOpen);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileType, setNewProfileType] = useState<'standard' | 'blank' | 'clone'>('standard');
  const [dragOver, setDragOver] = useState(false);
  
  // In-app Delete Confirmation Dialog State
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ id: string; name: string; isActive: boolean } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const newNameInputRef = useRef<HTMLInputElement>(null);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteConfirmTarget) {
          setDeleteConfirmTarget(null);
        } else if (editingId) {
          setEditingId(null);
        } else if (showCreateDialog) {
          setShowCreateDialog(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteConfirmTarget, editingId, showCreateDialog, onClose]);

  // Focus rename input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  // Focus create input when dialog opens
  useEffect(() => {
    if (showCreateDialog && newNameInputRef.current) {
      newNameInputRef.current.focus();
    }
  }, [showCreateDialog]);

  // 1. Add / Create New Profile
  const handleCreateSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalName = newProfileName.trim() || `Profile ${profiles.length + 1}`;
    
    const newProfile = { 
      id: uuidv4(), 
      name: finalName,
      isDefault: false,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      description: newProfileType === 'clone' 
        ? 'Cloned from active workspace' 
        : newProfileType === 'blank' 
          ? 'Fresh blank workspace profile' 
          : 'Standard church presentation profile'
    };

    addProfile(newProfile);
    setActiveProfile(newProfile.id);
    
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `Created & Activated Profile: "${finalName}"` 
      })
    );

    setNewProfileName('');
    setShowCreateDialog(false);
  };

  // 2. Inline Edit & Rename Profile
  const handleStartEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const handleSaveEdit = (id: string) => {
    const trimmed = editName.trim();
    if (trimmed) {
      updateProfile(id, { name: trimmed });
      window.dispatchEvent(
        new CustomEvent('simpleworship:notify', { 
          detail: `Profile Renamed to "${trimmed}"` 
        })
      );
    }
    setEditingId(null);
  };

  // 3. Initiate Delete (Opens Custom In-App Modal Dialog)
  const handleRequestDelete = (id: string, name: string, isDefault: boolean) => {
    if (isDefault) {
      setErrorMessage('The Default profile cannot be deleted.');
      setTimeout(() => setErrorMessage(null), 3500);
      return;
    }
    if (profiles.length <= 1) {
      setErrorMessage('Cannot delete the only remaining profile in the system.');
      setTimeout(() => setErrorMessage(null), 3500);
      return;
    }
    setDeleteConfirmTarget({
      id,
      name,
      isActive: id === activeProfileId
    });
  };

  // Execute Confirmed Delete
  const handleConfirmDelete = () => {
    if (!deleteConfirmTarget) return;
    const { id, name, isActive } = deleteConfirmTarget;

    removeProfile(id);
    setDeleteConfirmTarget(null);

    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: isActive 
          ? `Deleted Profile "${name}" & Switched to Default` 
          : `Permanently Deleted Profile "${name}"` 
      })
    );
  };

  // 4. Duplicate / Clone Profile
  const handleClone = (id: string, name: string) => {
    const cloned = {
      id: uuidv4(),
      name: `${name} (Copy)`,
      isDefault: false,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      description: `Cloned from ${name}`
    };
    addProfile(cloned);
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `Duplicated profile "${name}" as "${cloned.name}"` 
      })
    );
  };

  // 5. Export Portable Profile Bundle (.swprofile / .swp)
  const handleExportProfile = async (profile: any) => {
    try {
      setIsExporting(profile.id);
      const pkg = await exportPortableProfile(profile, {
        activeSchedule,
        shortcutSettings
      });
      downloadPortableProfilePackage(pkg);
      window.dispatchEvent(
        new CustomEvent('simpleworship:notify', { 
          detail: `Portable Package Exported: ${pkg.profile.name} (${pkg.stats.songCount} songs, ${pkg.stats.themeCount} themes)` 
        })
      );
    } catch (err: any) {
      console.error('Export profile error:', err);
      setErrorMessage(`Export failed: ${err.message || err}`);
      setTimeout(() => setErrorMessage(null), 4000);
    } finally {
      setIsExporting(null);
    }
  };

  // 6. Import Portable Profile Bundle from File
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processImportFile(files[0]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processImportFile = async (file: File) => {
    try {
      setIsImporting(true);
      const text = await file.text();
      const pkg = parsePortableProfilePackage(text);
      
      const { profile: importedProfile, summary } = await importPortableProfileToDatabase(pkg);
      addProfile(importedProfile);
      setActiveProfile(importedProfile.id);

      window.dispatchEvent(
        new CustomEvent('simpleworship:notify', { 
          detail: `Imported & Activated: "${importedProfile.name}" (${summary})` 
        })
      );
    } catch (err: any) {
      console.error('Import profile error:', err);
      setErrorMessage(`Import Failed: ${err.message || 'Invalid or corrupted profile package'}`);
      setTimeout(() => setErrorMessage(null), 4000);
    } finally {
      setIsImporting(false);
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processImportFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-[99999] p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`bg-[#1c1f26] border ${dragOver ? 'border-cyan-400 ring-4 ring-cyan-500/40 shadow-[0_0_30px_rgba(6,182,212,0.4)]' : 'border-[#2d313a]'} rounded-xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 transition-all relative`}
      >
        {/* Hidden File Input for Portable Profile Import */}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept=".swprofile,.swp,.json" 
          className="hidden" 
        />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2d313a] bg-[#16181e]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
              <FolderArchive size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-100 leading-tight">Profiles Manager</h2>
              <p className="text-[11px] text-gray-400">Portable worship database, custom configurations & multi-device profiles</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 rounded-md hover:bg-[#2d313a] text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="Close Profiles Manager (Esc)"
          >
            <X size={18} />
          </button>
        </div>
        
        {/* Main Content Body */}
        <div className="p-6 flex-1 overflow-y-auto max-h-[60vh] space-y-4">
          
          {/* Error / Warning Alert Banner */}
          {errorMessage && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-rose-950/80 border border-rose-600/70 text-rose-200 text-xs shadow-md animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button 
                type="button"
                onClick={() => setErrorMessage(null)} 
                className="text-rose-400 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Portable Info Banner */}
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#222630] border border-[#2e3340] text-gray-300 text-xs shadow-inner">
            <Info size={16} className="text-cyan-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold text-gray-100 flex items-center gap-1.5">
                Portable Plug-and-Play Profiles
                <span className="text-[10px] bg-cyan-900/60 text-cyan-200 px-1.5 py-0.2 rounded border border-cyan-700/50">USB Ready</span>
              </span>
              <p className="text-gray-400 text-[11px] leading-relaxed">
                Just like EasyWorship, you can export any profile as a portable <code className="text-cyan-300 font-mono bg-black/50 px-1 py-0.5 rounded border border-cyan-900/50">.swprofile</code> file to USB or cloud, then import it on any computer or device to load songs, themes, and settings instantly.
              </p>
            </div>
          </div>

          {/* Quick Create Dialog (Collapsible) */}
          {showCreateDialog && (
            <form onSubmit={handleCreateSubmit} className="p-4 rounded-lg bg-[#222633] border border-cyan-500/50 space-y-3 animate-in fade-in zoom-in-95 shadow-lg">
              <div className="flex items-center justify-between border-b border-[#2d3342] pb-2">
                <span className="text-xs font-bold text-cyan-300 uppercase tracking-wide flex items-center gap-1.5">
                  <Sparkles size={14} className="text-cyan-400" />
                  Create New Profile
                </span>
                <button 
                  type="button" 
                  onClick={() => setShowCreateDialog(false)}
                  className="text-gray-400 hover:text-white text-xs cursor-pointer px-1.5 py-0.5 rounded hover:bg-[#2d313a]"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-300 mb-1">Profile Name</label>
                <input
                  ref={newNameInputRef}
                  type="text"
                  placeholder="e.g. Sunday Morning, Youth Ministry, Midweek Service"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  className="w-full bg-[#14161c] border border-[#3b404d] focus:border-cyan-400 rounded px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-300 mb-1">Profile Data Preset</label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setNewProfileType('standard')}
                    className={`p-2 rounded border text-left transition-all cursor-pointer ${
                      newProfileType === 'standard' 
                        ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200 shadow-xs' 
                        : 'bg-[#181a22] border-[#2e3340] text-gray-400 hover:text-gray-200 hover:bg-[#1f222c]'
                    }`}
                  >
                    <div className="font-semibold text-[11px] text-gray-100">Standard Starter</div>
                    <div className="text-[10px] text-gray-400">Standard hymnal & themes</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewProfileType('clone')}
                    className={`p-2 rounded border text-left transition-all cursor-pointer ${
                      newProfileType === 'clone' 
                        ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200 shadow-xs' 
                        : 'bg-[#181a22] border-[#2e3340] text-gray-400 hover:text-gray-200 hover:bg-[#1f222c]'
                    }`}
                  >
                    <div className="font-semibold text-[11px] text-gray-100">Clone Current</div>
                    <div className="text-[10px] text-gray-400">Copy current active data</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewProfileType('blank')}
                    className={`p-2 rounded border text-left transition-all cursor-pointer ${
                      newProfileType === 'blank' 
                        ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200 shadow-xs' 
                        : 'bg-[#181a22] border-[#2e3340] text-gray-400 hover:text-gray-200 hover:bg-[#1f222c]'
                    }`}
                  >
                    <div className="font-semibold text-[11px] text-gray-100">Blank Workspace</div>
                    <div className="text-[10px] text-gray-400">Fresh clean library</div>
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1 border-t border-[#2d3342]">
                <button
                  type="button"
                  onClick={() => setShowCreateDialog(false)}
                  className="px-3 py-1 rounded bg-[#2d313a] text-gray-300 text-xs hover:bg-[#3b404d] hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs shadow-md cursor-pointer transition-all active:scale-95"
                >
                  Create & Activate
                </button>
              </div>
            </form>
          )}

          {/* Profiles List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1">
              <span>Available Profiles ({profiles.length})</span>
              <span>Actions</span>
            </div>

            {profiles.map(profile => {
              const isActive = activeProfileId === profile.id;
              const isExportingThis = isExporting === profile.id;

              return (
                <div 
                  key={profile.id} 
                  onClick={() => {
                    if (!isActive && editingId !== profile.id && !deleteConfirmTarget) {
                      setActiveProfile(profile.id);
                    }
                  }}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-150 cursor-pointer ${
                    isActive 
                      ? 'bg-[#212632] border-cyan-500/70 shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/40' 
                      : 'bg-[#20232b] border-[#2d313a] hover:border-[#3d4352] hover:bg-[#252934]'
                  }`}
                >
                  {/* Left Column: Radio dot & Name */}
                  <div className="flex items-center space-x-3 flex-1 mr-4 min-w-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveProfile(profile.id);
                      }}
                      className="cursor-pointer p-0.5 rounded-full focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      title={isActive ? 'Active Profile' : `Switch to "${profile.name}"`}
                    >
                      <div 
                        className={`w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center transition-all ${
                          isActive 
                            ? 'bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.9)] ring-2 ring-cyan-400/40' 
                            : 'border-2 border-gray-500 bg-transparent hover:border-cyan-400'
                        }`}
                      >
                        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[#1c1f26]"></div>}
                      </div>
                    </button>

                    {editingId === profile.id ? (
                      <div 
                        className="flex items-center gap-1.5 flex-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          ref={editInputRef}
                          type="text"
                          className="flex-1 bg-[#14161c] border border-cyan-500 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { 
                            if (e.key === 'Enter') handleSaveEdit(profile.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                        />
                        <button 
                          type="button"
                          onClick={() => handleSaveEdit(profile.id)} 
                          className="p-1 rounded bg-cyan-600/40 text-cyan-300 hover:bg-cyan-600/70 cursor-pointer transition-colors" 
                          title="Save Name"
                        >
                          <Check size={14} />
                        </button>
                        <button 
                          type="button"
                          onClick={() => setEditingId(null)} 
                          className="p-1 rounded bg-gray-700/50 text-gray-300 hover:bg-gray-700 cursor-pointer transition-colors" 
                          title="Cancel"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="truncate flex items-center gap-2">
                        <span className={`text-sm font-semibold truncate ${isActive ? 'text-white' : 'text-gray-200'}`}>
                          {profile.name}
                        </span>
                        {profile.isDefault && (
                          <span className="text-[10px] font-bold bg-[#2d323e] text-gray-300 px-2 py-0.5 rounded border border-gray-600/60">
                            Default
                          </span>
                        )}
                        {isActive && (
                          <span className="text-[10px] font-bold bg-cyan-950/90 text-cyan-300 px-2 py-0.5 rounded border border-cyan-700/60">
                            In Use
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Right Column: Action Buttons */}
                  <div 
                    className="flex items-center space-x-1.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {editingId !== profile.id && (
                      <>
                        {/* Switch Button (only shown for non-active profiles) */}
                        {!isActive && (
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveProfile(profile.id);
                            }} 
                            className="px-3 py-1 rounded bg-[#2b303c] text-gray-200 hover:bg-cyan-600 hover:text-white text-xs font-medium transition-colors cursor-pointer border border-[#3b404d] shadow-xs active:scale-95" 
                            title={`Switch to profile "${profile.name}"`}
                          >
                            Switch
                          </button>
                        )}

                        {/* Export Portable Package (.swprofile) */}
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExportProfile(profile);
                          }} 
                          disabled={isExportingThis}
                          className="p-1.5 rounded hover:bg-cyan-950/70 text-gray-400 hover:text-cyan-300 transition-colors border border-transparent hover:border-cyan-800/60 cursor-pointer" 
                          title="Export Portable Profile Package (.swprofile) for USB / Device Transfer"
                        >
                          <Download size={14} className={isExportingThis ? 'animate-bounce text-cyan-400' : ''} />
                        </button>

                        {/* Clone / Duplicate Profile */}
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClone(profile.id, profile.name);
                          }} 
                          className="p-1.5 rounded hover:bg-[#2d313a] text-gray-400 hover:text-sky-300 transition-colors cursor-pointer" 
                          title="Duplicate Profile"
                        >
                          <Copy size={14} />
                        </button>

                        {/* Rename Profile */}
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(profile.id, profile.name);
                          }} 
                          className="p-1.5 rounded hover:bg-[#2d313a] text-gray-400 hover:text-white transition-colors cursor-pointer" 
                          title="Rename Profile"
                        >
                          <Edit2 size={14} />
                        </button>

                        {/* Delete Profile Button */}
                        {!profile.isDefault && (
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleRequestDelete(profile.id, profile.name, Boolean(profile.isDefault));
                            }} 
                            className="p-1.5 rounded bg-rose-950/30 hover:bg-rose-900/60 text-rose-400 hover:text-rose-200 transition-all border border-rose-800/40 hover:border-rose-600 cursor-pointer shadow-xs active:scale-90" 
                            title={`Delete profile "${profile.name}"`}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-[#2d313a] bg-[#16181e] flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            {!showCreateDialog && (
              <button 
                type="button"
                onClick={() => setShowCreateDialog(true)} 
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-600/30 transition-colors text-xs font-semibold cursor-pointer shadow-xs active:scale-95"
                title="Create a new profile"
              >
                <Plus size={14} />
                <span>+ Create New Profile</span>
              </button>
            )}

            {/* Import Portable Profile Package Button */}
            <button 
              type="button"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                  fileInputRef.current.click();
                }
              }} 
              disabled={isImporting}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#272b36] text-gray-200 border border-[#383e4d] hover:bg-[#323847] hover:text-white transition-colors text-xs font-medium cursor-pointer active:scale-95"
              title="Load portable .swprofile package from USB or file"
            >
              <Upload size={14} className={isImporting ? 'animate-spin text-cyan-400' : 'text-cyan-400'} />
              <span>{isImporting ? 'Importing...' : 'Import Portable Profile...'}</span>
            </button>
          </div>

          <button 
            type="button"
            onClick={onClose} 
            className="px-4 py-1.5 rounded-lg bg-[#2d313a] text-gray-200 hover:bg-[#3b404d] hover:text-white transition-colors text-xs font-medium cursor-pointer active:scale-95"
            title="Close dialog"
          >
            Close
          </button>
        </div>

        {/* In-App Delete Confirmation Modal Overlay */}
        {deleteConfirmTarget && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-6 z-[100] animate-in fade-in duration-150">
            <div className="bg-[#20181b] border-2 border-rose-600/80 rounded-xl p-5 max-w-sm w-full shadow-[0_0_30px_rgba(225,29,72,0.3)] space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3 text-rose-400 border-b border-rose-900/60 pb-3">
                <div className="p-2 rounded-lg bg-rose-950/90 border border-rose-700/60">
                  <Trash2 size={20} className="text-rose-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-100">Delete Profile?</h3>
                  <p className="text-[11px] text-rose-300/90 font-medium">This action cannot be undone.</p>
                </div>
              </div>

              <div className="text-xs text-gray-300 space-y-2">
                <p>
                  Are you sure you want to delete profile <strong className="text-white bg-black/40 px-1.5 py-0.5 rounded border border-rose-900/50">"{deleteConfirmTarget.name}"</strong>?
                </p>
                {deleteConfirmTarget.isActive && (
                  <p className="text-[11px] text-amber-300 bg-amber-950/40 p-2 rounded border border-amber-800/50">
                    ⚠️ This profile is currently active in your workspace. Deleting it will automatically switch your active profile back to <strong>Default</strong>.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-rose-950/80">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmTarget(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#2b2d35] hover:bg-[#383b45] text-gray-300 text-xs font-medium cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <Trash2 size={13} />
                  <span>Delete Profile</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
