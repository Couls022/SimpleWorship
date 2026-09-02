import React, { useRef } from 'react';
import { X, Printer, FileText, Calendar, Clock, Download, Check } from 'lucide-react';
import { useStore } from '../store/useStore';
import SimpleWorshipLogo from './SimpleWorshipLogo';

interface PrintScheduleModalProps {
  onClose: () => void;
}

export default function PrintScheduleModal({ onClose }: PrintScheduleModalProps) {
  const store = useStore();
  const schedule = store.activeSchedule;
  const printAreaRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleExportText = () => {
    if (!schedule) return;
    let report = `========================================================\n`;
    report += `SIMPLEWORSHIP - ORDER OF SERVICE / SCHEDULE REPORT\n`;
    report += `Schedule: ${schedule.name}\n`;
    report += `Generated: ${new Date().toLocaleString()}\n`;
    report += `Total Items: ${schedule.items.length}\n`;
    report += `========================================================\n\n`;

    schedule.items.forEach((item, index) => {
      report += `${index + 1}. [${item.type.toUpperCase()}] ${item.name}\n`;
      if (item.notes) {
        report += `   Notes: ${item.notes}\n`;
      }
      report += `\n`;
    });

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${schedule.name.replace(/[^a-z0-9]/gi, '_')}_order_of_service.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/75 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-[#1c1e26] border border-[#353b4c] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-gray-200 select-none animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e3344] bg-[#222632]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Printer size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Order of Service & Schedule Report</h2>
              <p className="text-xs text-gray-400">Formatted printable service rundown and song list</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Printable View Area */}
        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-[#161820]">
          <div 
            ref={printAreaRef}
            className="bg-white text-gray-900 rounded-lg p-8 shadow-md font-sans text-xs space-y-6 max-w-xl mx-auto"
          >
            {/* Header branding */}
            <div className="border-b-2 border-gray-800 pb-4 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-black text-gray-950 tracking-tight">SimpleWorship</h1>
                <h2 className="text-sm font-bold text-cyan-800 mt-0.5">{schedule?.name || 'Worship Service Schedule'}</h2>
              </div>
              <div className="text-right text-[11px] text-gray-500">
                <div>Date: {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                <div>Items: {schedule?.items.length || 0} Total</div>
              </div>
            </div>

            {/* Schedule Items Rundown */}
            <div className="space-y-3">
              <h3 className="font-bold text-xs uppercase tracking-wider text-gray-600 border-b border-gray-200 pb-1">
                Order of Service Rundown
              </h3>

              {(!schedule || schedule.items.length === 0) ? (
                <div className="py-6 text-center text-gray-400 italic">No items in the active schedule.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {schedule.items.map((item, idx) => (
                    <div key={item.id || idx} className="py-2 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-bold text-gray-900 text-sm">{item.name}</div>
                          {item.notes && <div className="text-[11px] text-gray-600 italic mt-0.5">{item.notes}</div>}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-700 shrink-0">
                        {item.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer notes */}
            <div className="border-t border-gray-200 pt-4 flex items-center justify-between text-[10px] text-gray-400">
              <span>Prepared with SimpleWorship Pro Presentation Suite</span>
              <span>Page 1 of 1</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3 border-t border-[#2e3344] bg-[#20232e] flex items-center justify-between">
          <button
            onClick={handleExportText}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2d3240] hover:bg-[#3b4152] text-gray-200 rounded-lg text-xs font-semibold transition-colors"
          >
            <Download size={14} />
            <span>Export Text (.txt)</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-[#2d3240] hover:bg-[#3b4152] text-gray-300 rounded-lg text-xs font-medium transition-colors"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-xs transition-colors shadow-md"
            >
              <Printer size={14} />
              <span>Print Order of Service</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
