import re

with open('src/components/LivePanel.tsx', 'r') as f:
    content = f.read()

# Replace the plain text div with a styled one
old_code = """                        {viewMode !== 'summary' && (
                          <div className={`${viewMode === 'large' ? 'p-3 text-sm min-h-[64px]' : viewMode === 'small' ? 'p-1.5 text-[10px] min-h-[32px]' : 'p-2 text-[11px] min-h-[48px]'} text-gray-200 leading-relaxed font-sans whitespace-pre-line bg-[#1c1e24]`}>
                            {slide.text}
                          </div>
                        )}"""

new_code = """                        {viewMode !== 'summary' && (
                          <div 
                            className={`${viewMode === 'large' ? 'p-3 text-sm min-h-[64px]' : viewMode === 'small' ? 'p-1.5 text-[10px] min-h-[32px]' : 'p-2 text-[11px] min-h-[48px]'} leading-relaxed font-sans whitespace-pre-line bg-[#1c1e24] bg-cover bg-center relative overflow-hidden`}
                            style={{
                              backgroundImage: slide.backgroundUrl ? (slide.backgroundUrl.startsWith('linear-gradient') ? slide.backgroundUrl : `url(${slide.backgroundUrl})`) : undefined,
                            }}
                          >
                            {slide.backgroundUrl && <div className="absolute inset-0 bg-black/40 pointer-events-none" />}
                            <div 
                              className="relative z-10"
                              style={{
                                textTransform: (isSong && (systemOptions?.mainOutput?.song?.allCapsLyrics || systemOptions?.mainOutput?.song?.songFont?.casing === 'uppercase')) ? 'uppercase' : undefined,
                                color: slide.backgroundUrl ? '#ffffff' : '#e5e7eb',
                                textShadow: slide.backgroundUrl ? '0px 1px 4px rgba(0,0,0,0.9)' : undefined,
                                textAlign: 'center',
                                fontWeight: '700'
                              }}
                            >
                              {slide.text}
                            </div>
                          </div>
                        )}"""

if old_code in content:
    content = content.replace(old_code, new_code)
    with open('src/components/LivePanel.tsx', 'w') as f:
        f.write(content)
    print("Patched LivePanel.tsx successfully!")
else:
    print("Could not find old_code in LivePanel.tsx")
