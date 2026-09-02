const fs = require('fs');
let code = fs.readFileSync('src/components/options/SongLivePreview.tsx', 'utf8');

const regex = /\{\/\* 16:9 \(or dynamic output resolution ratio\) Monitor Stage Frame \*\/\}(.|\n)*?(?=\<\/div\>\n    \<\/div\>\n  \);\n)/;

if (regex.test(code)) {
  const replacement = `{/* 16:9 (or dynamic output resolution ratio) Monitor Stage Frame */}
      <div className="relative w-full max-w-2xl mx-auto rounded-xl bg-black/90 p-2 shadow-2xl border border-cyan-500/20 overflow-hidden">
        {/* Monitor Bezel Header Bar */}
        <div className="flex items-center justify-between text-[10px] text-gray-400 px-2 pb-1.5 select-none relative z-20">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span className="font-semibold text-gray-300">Projector Canvas #{generalOptions?.outputMonitor || 'Main'}</span>
          </div>
          <div className="font-mono text-cyan-400/90 font-bold">
            {ratioBadge} • {width} × {height} px
          </div>
        </div>

        {/* The Exact Ratio Stage Display Box */}
        <div 
          className="relative w-full rounded-lg overflow-hidden flex flex-col justify-between shadow-inner transition-all border border-white/10 select-none"
          style={{ aspectRatio: \`\${width} / \${height}\` }}
        >
          {/* Scaled 1080p Canvas */}
          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{
              width: \`\${width}px\`,
              height: \`\${height}px\`,
              transform: \`scale(calc(100% / \${width}))\`,
              background: activeBg.gradient,
              paddingLeft: \`\${Math.max(4, padLeftPercent)}%\`,
              paddingRight: \`\${Math.max(4, padRightPercent)}%\`,
              paddingTop: \`\${Math.max(3, padTopPercent)}%\`,
              paddingBottom: \`\${Math.max(3, padBottomPercent)}%\`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            {/* Backdrop Overlay */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ backgroundColor: activeBg.overlay }}
            />

            {/* Top Left / Top Right Corner Section Label Badge */}
            {showLabel && formattedLabel && (
              <>
                {labelLoc === 'Top Right' && (
                  <div
                    className="absolute top-8 right-10 z-20 px-4 py-2 rounded-lg bg-black/55 backdrop-blur-md border border-white/15 drop-shadow-xl font-bold"
                    style={{
                      ...ThemeEngine.getTextStyle(labelThemeStyles, 1),
                      fontSize: labelThemeStyles.fontSize ? \`\${labelThemeStyles.fontSize}px\` : '36px',
                      color: labelThemeStyles.fontColor || '#67E8F9',
                    }}
                  >
                    {formattedLabel}
                  </div>
                )}
                {labelLoc === 'Top Left' && (
                  <div
                    className="absolute top-8 left-10 z-20 px-4 py-2 rounded-lg bg-black/55 backdrop-blur-md border border-white/15 drop-shadow-xl font-bold"
                    style={{
                      ...ThemeEngine.getTextStyle(labelThemeStyles, 1),
                      fontSize: labelThemeStyles.fontSize ? \`\${labelThemeStyles.fontSize}px\` : '36px',
                      color: labelThemeStyles.fontColor || '#67E8F9',
                    }}
                  >
                    {formattedLabel}
                  </div>
                )}
              </>
            )}

            {/* Top Header Section Label (Header Position) */}
            {showLabel && labelLoc === 'Header' && formattedLabel && (
              <div
                className="relative z-10 text-center font-bold tracking-wider mb-4 drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] max-w-full"
                style={{
                  ...ThemeEngine.getTextStyle(labelThemeStyles, 1),
                  fontSize: labelThemeStyles.fontSize ? \`\${labelThemeStyles.fontSize}px\` : '42px',
                  color: labelThemeStyles.fontColor || '#67E8F9',
                  textAlign: (labelThemeStyles.textAlign as any) || 'center',
                }}
              >
                {formattedLabel}
              </div>
            )}

            {/* Main Lyrics Body Text Layer */}
            {(() => {
              const rawLyrics = currentSlide.lines.join('\\n');
              const autoFitSize = ThemeEngine.calculateAutoFitFontSize({
                text: rawLyrics,
                baseFontSize: songThemeStyles.fontSize || songOptions?.songFont?.maxSize || 64,
                hasHeader: showLabel && labelLoc === 'Header',
                hasFooter: isCopyrightVisible,
                scale: 1,
                minFontSize: songOptions?.minFontSize || 22,
                maxFontSize: 160,
                isUppercase: allCapsLyrics || songOptions?.songFont?.casing === 'uppercase',
                lineSpacing: songOptions?.lineSpacing || 1.3,
                margins: generalOptions?.margins,
              });

              return (
                <div className="relative z-10 my-auto flex flex-col justify-center items-center w-full overflow-hidden">
                  <div
                    className="font-bold leading-snug max-w-full drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)] whitespace-pre-line"
                    style={{
                      ...ThemeEngine.getTextStyle(songThemeStyles, 1),
                      fontSize: \`\${autoFitSize}px\`,
                      fontFamily: songThemeStyles.fontFamily || 'Tahoma, sans-serif',
                      textAlign: (songThemeStyles.textAlign as any) || 'center',
                      color: songThemeStyles.fontColor || '#FFFFFF',
                      lineHeight: songOptions?.lineSpacing || 1.3,
                      textTransform: allCapsLyrics ? 'uppercase' : undefined
                    }}
                  >
                    {currentSlide.lines.map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Bottom Left / Bottom Right Section Label Badge */}
            {showLabel && formattedLabel && (
              <>
                {labelLoc === 'Bottom Right' && (
                  <div
                    className="absolute bottom-8 right-10 z-20 px-4 py-2 rounded-lg bg-black/55 backdrop-blur-md border border-white/15 drop-shadow-xl font-bold"
                    style={{
                      ...ThemeEngine.getTextStyle(labelThemeStyles, 1),
                      fontSize: labelThemeStyles.fontSize ? \`\${labelThemeStyles.fontSize}px\` : '36px',
                      color: labelThemeStyles.fontColor || '#67E8F9',
                    }}
                  >
                    {formattedLabel}
                  </div>
                )}
                {labelLoc === 'Bottom Left' && (
                  <div
                    className="absolute bottom-8 left-10 z-20 px-4 py-2 rounded-lg bg-black/55 backdrop-blur-md border border-white/15 drop-shadow-xl font-bold"
                    style={{
                      ...ThemeEngine.getTextStyle(labelThemeStyles, 1),
                      fontSize: labelThemeStyles.fontSize ? \`\${labelThemeStyles.fontSize}px\` : '36px',
                      color: labelThemeStyles.fontColor || '#67E8F9',
                    }}
                  >
                    {formattedLabel}
                  </div>
                )}
              </>
            )}

            {/* Copyright / License Info overlay */}
            {isCopyrightVisible && (
              <div
                className="relative z-10 w-full mt-auto mb-2 opacity-80"
                style={{
                  textAlign: (copyrightThemeStyles.textAlign as any) || 'left',
                }}
              >
                <div
                  className="font-mono tracking-wide drop-shadow-md"
                  style={{
                    ...ThemeEngine.getTextStyle(copyrightThemeStyles, 1),
                    fontSize: copyrightThemeStyles.fontSize ? \`\${copyrightThemeStyles.fontSize}px\` : '18px',
                    color: copyrightThemeStyles.fontColor || '#A0AEC0',
                  }}
                >
                  {licenseText}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>`;
  code = code.replace(regex, replacement);
  fs.writeFileSync('src/components/options/SongLivePreview.tsx', code);
  console.log("Patched successfully");
} else {
  console.log("Regex did not match");
}
