const fs = require('fs');
let code = fs.readFileSync('src/components/MonitorPreviewCanvas.tsx', 'utf8');

const marqueeStr = `<marquee scrollamount="20" className="w-full flex items-center">
                  <div className="text-7xl font-bold whitespace-nowrap flex items-center gap-8 inline-flex">
                    <span className="px-6 py-2 rounded-xl bg-amber-500 text-black text-5xl font-black uppercase tracking-wider shrink-0">
                      ALERT
                    </span>
                    <span>{currentAlert.message}</span>
                  </div>
                </marquee>`;

const cssAnimationStr = `<div className="w-full flex items-center overflow-hidden">
                  <div className="text-7xl font-bold whitespace-nowrap flex items-center gap-8 inline-flex animate-marquee">
                    <span className="px-6 py-2 rounded-xl bg-amber-500 text-black text-5xl font-black uppercase tracking-wider shrink-0">
                      ALERT
                    </span>
                    <span>{currentAlert.message}</span>
                  </div>
                </div>`;

code = code.replace(marqueeStr, cssAnimationStr);
fs.writeFileSync('src/components/MonitorPreviewCanvas.tsx', code);

// Now we need to add the animation to tailwind.config.js or index.css
