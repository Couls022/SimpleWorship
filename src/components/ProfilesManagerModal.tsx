import React, { useState } from 'react';
import { X, Plus, Trash2, Edit2, Check } from 'lucide-react';
import { useStore } from '../store/useStore';
import { v4 as uuidv4 } from 'uuid';

export default function ProfilesManagerModal({ onClose }: { onClose: () => void }) {
  const { profiles, activeProfileId, addProfile, updateProfile, removeProfile, setActiveProfile } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleAdd = () => {
    const newProfile = { id: uuidv4(), name: 'New Profile' };
    addProfile(newProfile);
    setEditingId(newProfile.id);
    setEditName(newProfile.name);
  };

  const handleSaveEdit = (id: string) => {
    if (editName.trim()) {
      updateProfile(id, { name: editName.trim() });
    }
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this profile?')) {
      removeProfile(id);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-[99999] p-4 animate-in fade-in duration-150">
      <div className="bg-[#1e2128] border border-[#2d313a] rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2d313a] bg-[#1a1d24]">
          <h2 className="text-lg font-semibold text-gray-100">Profiles Manager</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-[#2d313a] text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-6 flex-1 overflow-y-auto">
          <div className="space-y-2">
            {profiles.map(profile => (
              <div key={profile.id} className="flex items-center justify-between p-3 rounded-lg bg-[#252830] border border-[#2d313a] hover:border-[#3b404d] transition-colors">
                <div className="flex items-center space-x-3 flex-1 mr-4">
                  <div className={`w-2 h-2 rounded-full ${activeProfileId === profile.id ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]' : 'bg-transparent'}`}></div>
                  {editingId === profile.id ? (
                    <input
                      type="text"
                      className="flex-1 bg-[#1a1d24] border border-[#3b404d] rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-cyan-500"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(profile.id); }}
                      autoFocus
                    />
                  ) : (
                    <span className="text-sm font-medium text-gray-200">
                      {profile.name}
                      {profile.isDefault && <span className="ml-2 text-xs bg-[#2d313a] text-gray-400 px-2 py-0.5 rounded">Default</span>}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center space-x-1">
                  {editingId === profile.id ? (
                    <button onClick={() => handleSaveEdit(profile.id)} className="p-1.5 rounded bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/40 transition-colors" title="Save">
                      <Check size={14} />
                    </button>
                  ) : (
                    <>
                      {activeProfileId !== profile.id && (
                        <button onClick={() => setActiveProfile(profile.id)} className="px-3 py-1 rounded bg-[#2d313a] text-gray-300 hover:bg-[#3b404d] hover:text-white text-xs transition-colors" title="Set Active">
                          Switch
                        </button>
                      )}
                      {!profile.isDefault && (
                        <button onClick={() => { setEditingId(profile.id); setEditName(profile.name); }} className="p-1.5 rounded hover:bg-[#2d313a] text-gray-400 hover:text-white transition-colors" title="Rename">
                          <Edit2 size={14} />
                        </button>
                      )}
                      {!profile.isDefault && (
                        <button onClick={() => handleDelete(profile.id)} className="p-1.5 rounded hover:bg-red-500/20 text-red-400 hover:bg-red-500/40 transition-colors" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="px-6 py-4 border-t border-[#2d313a] bg-[#1a1d24] flex justify-between items-center">
          <button onClick={handleAdd} className="flex items-center space-x-2 px-4 py-2 rounded-md bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/40 hover:text-blue-300 transition-colors text-sm font-medium">
            <Plus size={16} />
            <span>Create New Profile</span>
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-md bg-[#2d313a] text-gray-200 hover:bg-[#3b404d] transition-colors text-sm font-medium">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
