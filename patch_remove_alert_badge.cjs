const fs = require('fs');
let code = fs.readFileSync('src/components/MonitorPreviewCanvas.tsx', 'utf8');

const marqueeStr = `<div className="text-7xl font-bold whitespace-nowrap flex items-center gap-8 inline-flex animate-marquee">
                    <span className="px-6 py-2 rounded-xl bg-amber-500 text-black text-5xl font-black uppercase tracking-wider shrink-0">
                      ALERT
                    </span>
                    <span>{currentAlert.message}</span>
                  </div>`;

const newMarqueeStr = `<div className="text-7xl font-bold whitespace-nowrap flex items-center gap-8 inline-flex animate-marquee">
                    <span>{currentAlert.message}</span>
                  </div>`;

const staticStr = `<div className="w-full text-7xl font-bold flex items-center justify-center gap-8 text-center whitespace-pre-wrap break-words">
                  <span className="px-6 py-2 rounded-xl bg-amber-500 text-black text-5xl font-black uppercase tracking-wider shrink-0">
                    ALERT
                  </span>
                  <span>{currentAlert.message}</span>
                </div>`;

const newStaticStr = `<div className="w-full text-7xl font-bold flex items-center justify-center gap-8 text-center whitespace-pre-wrap break-words">
                  <span>{currentAlert.message}</span>
                </div>`;

code = code.replace(marqueeStr, newMarqueeStr);
code = code.replace(staticStr, newStaticStr);

fs.writeFileSync('src/components/MonitorPreviewCanvas.tsx', code);
