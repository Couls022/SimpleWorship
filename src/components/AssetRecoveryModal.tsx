import React from 'react';
import { FileQuestion, Upload, CheckCircle2, ArrowRight } from 'lucide-react';

interface MissingAsset {
  id: string;
  name: string;
  type: 'image' | 'video' | 'presentation';
  sha256?: string;
}

interface AssetRecoveryModalProps {
  isOpen: boolean;
  missingAssets: MissingAsset[];
  onRelink: (assetId: string, file: File) => void;
  onIgnoreAll: () => void;
  onClose: () => void;
}

export default function AssetRecoveryModal({
  isOpen,
  missingAssets,
  onRelink,
  onIgnoreAll,
  onClose
}: AssetRecoveryModalProps) {
  if (!isOpen || missingAssets.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-in fade-in duration-150">
      <div className="bg-[#181920] border border-[#2d303b] rounded-xl shadow-2xl max-w-xl w-full p-6 text-gray-200">
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[#2d303b]">
          <div className="p-2.5 bg-amber-500/10 rounded-lg text-amber-400">
            <FileQuestion size={24} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Missing Service Assets Detected</h3>
            <p className="text-xs text-gray-400">
              The service package references external or unbundled assets that could not be located.
            </p>
          </div>
        </div>

        <div className="max-h-60 overflow-y-auto space-y-2 mb-6 pr-1">
          {missingAssets.map(asset => (
            <div 
              key={asset.id}
              className="flex items-center justify-between p-3 rounded-lg bg-[#111216] border border-[#252834]"
            >
              <div className="flex-1 min-w-0 pr-3">
                <div className="text-xs font-semibold text-gray-200 truncate">{asset.name}</div>
                <div className="text-[10px] text-gray-500 capitalize">{asset.type} • ID: {asset.id}</div>
              </div>

              <label className="cursor-pointer px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors">
                <Upload size={13} />
                <span>Locate...</span>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      onRelink(asset.id, e.target.files[0]);
                    }
                  }}
                />
              </label>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[#2d303b]">
          <button
            onClick={onIgnoreAll}
            className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-gray-200 transition-colors"
          >
            Continue with Fallback Themes
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
