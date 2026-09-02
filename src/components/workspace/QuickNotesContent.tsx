import React, { useState, useEffect } from 'react';
import { Save, Trash2, FileText } from 'lucide-react';

const NOTES_STORAGE_KEY = 'simpleworship_operator_quick_notes';

export default function QuickNotesContent() {
  const [notes, setNotes] = useState(() => {
    return localStorage.getItem(NOTES_STORAGE_KEY) || '1. Welcome & Announcements (Pastor)\n2. Praise & Worship (Set 1)\n3. Scripture Reading - Psalm 23\n4. Sermon Message\n5. Closing Benediction';
  });

  const [savedStatus, setSavedStatus] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(NOTES_STORAGE_KEY, notes);
  }, [notes]);

  const handleClear = () => {
    if (confirm('Clear all operator notes?')) {
      setNotes('');
    }
  };

  const handleSave = () => {
    localStorage.setItem(NOTES_STORAGE_KEY, notes);
    setSavedStatus('Notes saved locally');
    setTimeout(() => setSavedStatus(null), 2000);
  };

  return (
    <div className="h-full w-full bg-[#16181f] text-gray-200 p-2.5 flex flex-col justify-between overflow-hidden font-sans">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-2 border-b border-[#2d313d] text-xs">
        <div className="flex items-center gap-1.5 font-bold text-gray-300">
          <FileText size={13} className="text-cyan-400" />
          <span>Service Order & Operator Cues</span>
        </div>
        <div className="flex items-center gap-1">
          {savedStatus && <span className="text-[10px] text-emerald-400 mr-1">{savedStatus}</span>}
          <button
            onClick={handleSave}
            className="p-1 hover:bg-[#2e3240] text-gray-400 hover:text-white rounded"
            title="Save Notes"
          >
            <Save size={12} />
          </button>
          <button
            onClick={handleClear}
            className="p-1 hover:bg-rose-950 text-gray-400 hover:text-rose-400 rounded"
            title="Clear Notes"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Editor Textarea */}
      <div className="flex-1 my-2">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Type live service cues, pastor sermon notes, or timing milestones here..."
          className="w-full h-full bg-[#111216] border border-[#272a34] rounded p-2 text-xs font-mono text-gray-200 placeholder:text-gray-600 resize-none focus:outline-hidden focus:border-cyan-500/60 leading-relaxed custom-scrollbar"
        />
      </div>

      {/* Footer Info */}
      <div className="text-[10px] text-gray-500 flex items-center justify-between pt-1 border-t border-[#262832]">
        <span>Auto-saved to local workspace</span>
        <span>{notes.length} characters</span>
      </div>
    </div>
  );
}
