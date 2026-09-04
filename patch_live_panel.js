const fs = require('fs');
let code = fs.readFileSync('src/components/LivePanel.tsx', 'utf8');

const targetStr = `{isScripture && slide.verses && slide.verses.length > 0 ? (
                                slide.verses.map((v: any, vIdx: number) => (
                                  <span key={v.verse || vIdx} className="inline">
                                    {(systemOptions?.mainOutput?.scripture?.showVerseNumbers ?? true) && (
                                      <span 
                                        className="font-bold inline-block mr-1.5 select-none"
                                        style={{ 
                                          color: systemOptions?.mainOutput?.scripture?.verseFont?.color || systemOptions?.mainOutput?.scripture?.verseColor || '#F6E05E',
                                          fontFamily: systemOptions?.mainOutput?.scripture?.verseFont?.family || resolvedStyles.fontFamily || 'Tahoma, sans-serif',
                                        }}
                                      >
                                        {formatVerseNumber(v.verse, systemOptions?.mainOutput?.scripture?.verseNumberStyle)}
                                      </span>
                                    )}
                                    <span>{v.text}</span>
                                    {vIdx < slide.verses.length - 1 && ' '}
                                  </span>
                                ))
                              ) : (
                                slide.text
                              )}`;

const replacementStr = `{liveItem?.type === 'camera' ? (
                                <div className="flex flex-col items-center justify-center opacity-80 h-full py-2">
                                  <MonitorUp size={24} className="mb-1 text-emerald-400" />
                                  <span className="text-[10px] font-mono text-emerald-300 font-semibold tracking-wider uppercase">{liveItem.name} • LIVE</span>
                                </div>
                              ) : liveItem?.type === 'video' ? (
                                <div className="flex flex-col items-center justify-center opacity-80 h-full py-2">
                                  <Film size={24} className="mb-1 text-cyan-400" />
                                  <span className="text-[10px] font-mono text-cyan-300 font-semibold tracking-wider uppercase truncate max-w-full px-2">
                                    {liveItem.name} • {liveItem.data?.url?.split('.').pop()?.toUpperCase() || 'VIDEO'}
                                  </span>
                                </div>
                              ) : liveItem?.type === 'audio' ? (
                                <div className="flex flex-col items-center justify-center opacity-80 h-full py-2">
                                  <Volume2 size={24} className="mb-1 text-purple-400" />
                                  <span className="text-[10px] font-mono text-purple-300 font-semibold tracking-wider uppercase truncate max-w-full px-2">
                                    {liveItem.name} • {liveItem.data?.url?.split('.').pop()?.toUpperCase() || 'AUDIO'}
                                  </span>
                                </div>
                              ) : liveItem?.type === 'image' ? (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  {slide.backgroundUrl ? (
                                    <img src={slide.backgroundUrl} alt="Preview" className="w-full h-full object-contain bg-black/60" />
                                  ) : (
                                    <span className="text-[10px] font-mono opacity-50">{liveItem.name}</span>
                                  )}
                                </div>
                              ) : liveItem?.type === 'presentation' ? (
                                <div className="absolute inset-0 bg-black overflow-hidden">
                                  {liveItem.data?.fileBytes ? (
                                    <React.Suspense fallback={<div className="flex h-full items-center justify-center text-[10px] text-white/30 font-mono">Loading...</div>}>
                                      <div className="w-full h-full pointer-events-none">
                                        <PptxRenderOverlay fileBytes={liveItem.data.fileBytes} activeSlideIndex={idx} />
                                      </div>
                                    </React.Suspense>
                                  ) : (
                                    <div className="flex h-full items-center justify-center text-[10px] text-white/50 p-2 text-center">
                                      {slide.title || 'Slide'}
                                    </div>
                                  )}
                                </div>
                              ) : isScripture && slide.verses && slide.verses.length > 0 ? (
                                slide.verses.map((v: any, vIdx: number) => (
                                  <span key={v.verse || vIdx} className="inline">
                                    {(systemOptions?.mainOutput?.scripture?.showVerseNumbers ?? true) && (
                                      <span 
                                        className="font-bold inline-block mr-1.5 select-none"
                                        style={{ 
                                          color: systemOptions?.mainOutput?.scripture?.verseFont?.color || systemOptions?.mainOutput?.scripture?.verseColor || '#F6E05E',
                                          fontFamily: systemOptions?.mainOutput?.scripture?.verseFont?.family || resolvedStyles.fontFamily || 'Tahoma, sans-serif',
                                        }}
                                      >
                                        {formatVerseNumber(v.verse, systemOptions?.mainOutput?.scripture?.verseNumberStyle)}
                                      </span>
                                    )}
                                    <span>{v.text}</span>
                                    {vIdx < slide.verses.length - 1 && ' '}
                                  </span>
                                ))
                              ) : (
                                slide.text
                              )}`;

if (code.indexOf(targetStr) === -1) {
  console.log("TARGET STRING NOT FOUND!");
} else {
  // Replace all occurrences (there should be 2)
  let newCode = code.split(targetStr).join(replacementStr);
  fs.writeFileSync('src/components/LivePanel.tsx', newCode);
  console.log("REPLACED SUCCESSFULLY!");
}
