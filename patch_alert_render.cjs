const fs = require('fs');
let code = fs.readFileSync('src/components/MonitorPreviewCanvas.tsx', 'utf8');

const oldAlert = `{currentAlert.active && (!currentAlert.targetGroupIds || currentAlert.targetGroupIds.length === 0 || currentAlert.targetGroupIds.includes(groupId)) && (
            <div 
              className="absolute left-0 right-0 z-40 py-4 px-8 overflow-hidden shadow-2xl border-y-2 border-amber-400"
              style={{
                bottom: currentAlert.position === 'bottom' ? 0 : 'auto',
                top: currentAlert.position === 'top' ? 0 : 'auto',
                backgroundColor: currentAlert.backgroundColor || 'rgba(15, 23, 42, 0.96)',
                color: currentAlert.textColor || '#FACC15',
              }}
            >
              <div className="text-2xl font-bold whitespace-nowrap flex items-center gap-4">
                <span className="px-3 py-1 rounded bg-amber-500 text-black text-base font-black uppercase tracking-wider">
                  ALERT
                </span>
                <span>{currentAlert.message}</span>
              </div>
            </div>
          )}`;

const newAlert = `{currentAlert.active && (!currentAlert.targetGroupIds || currentAlert.targetGroupIds.length === 0 || currentAlert.targetGroupIds.includes(groupId)) && (
            <div 
              className="absolute left-0 right-0 z-40 py-10 px-12 overflow-hidden shadow-2xl border-amber-400 flex items-center"
              style={{
                bottom: currentAlert.position === 'bottom' ? 0 : 'auto',
                top: currentAlert.position === 'top' ? 0 : 'auto',
                borderTopWidth: currentAlert.position === 'bottom' ? '6px' : '0px',
                borderBottomWidth: currentAlert.position === 'top' ? '6px' : '0px',
                backgroundColor: currentAlert.backgroundColor || 'rgba(15, 23, 42, 0.96)',
                color: currentAlert.textColor || '#FACC15',
                minHeight: '140px',
              }}
            >
              {(currentAlert.scrolling ?? true) ? (
                <marquee scrollamount="20" className="w-full flex items-center">
                  <div className="text-7xl font-bold whitespace-nowrap flex items-center gap-8 inline-flex">
                    <span className="px-6 py-2 rounded-xl bg-amber-500 text-black text-5xl font-black uppercase tracking-wider shrink-0">
                      ALERT
                    </span>
                    <span>{currentAlert.message}</span>
                  </div>
                </marquee>
              ) : (
                <div className="w-full text-7xl font-bold flex items-center justify-center gap-8 text-center whitespace-pre-wrap break-words">
                  <span className="px-6 py-2 rounded-xl bg-amber-500 text-black text-5xl font-black uppercase tracking-wider shrink-0">
                    ALERT
                  </span>
                  <span>{currentAlert.message}</span>
                </div>
              )}
            </div>
          )}`;

if (code.includes('className="absolute left-0 right-0 z-40 py-4 px-8 overflow-hidden shadow-2xl border-y-2 border-amber-400"')) {
    code = code.replace(oldAlert, newAlert);
    fs.writeFileSync('src/components/MonitorPreviewCanvas.tsx', code);
    console.log("MonitorPreviewCanvas.tsx patched successfully.");
} else {
    console.error("Could not find the target string in MonitorPreviewCanvas.tsx");
}
