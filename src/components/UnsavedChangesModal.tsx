import React from 'react';
import { AlertCircle } from 'lucide-react';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
  actionName?: string;
}

export default function UnsavedChangesModal({
  isOpen,
  onSave,
  onDiscard,
  onCancel,
  actionName = 'closing'
}: UnsavedChangesModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 p-4 animate-in fade-in duration-150">
      <div className="bg-[#18191f] border border-[#2b2d38] rounded-xl shadow-2xl max-w-md w-full p-6 text-gray-200">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-500/10 rounded-full text-amber-400">
            <AlertCircle size={28} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white mb-2">Unsaved Service Changes</h3>
            <p className="text-sm text-gray-300 mb-6">
              You have unsaved changes in your active service schedule before {actionName}. Would you like to save before proceeding?
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white bg-[#22242c] hover:bg-[#2c2f3a] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onDiscard}
                className="px-4 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 rounded-lg transition-colors"
              >
                Don't Save
              </button>
              <button
                onClick={onSave}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-lg shadow-indigo-600/30 transition-colors"
              >
                Save Service (.sws)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
