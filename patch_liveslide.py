import re

with open('src/components/LiveSlideCard.tsx', 'r') as f:
    content = f.read()

old_vid = """                {resolvedStyles.backgroundType === 'video' && (resolvedStyles.backgroundVideoUrl || slide.backgroundUrl || liveItem?.customBackgroundUrl) ? (
                  <video
                    src={slide.backgroundUrl || liveItem?.customBackgroundUrl || resolvedStyles.backgroundVideoUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none z-0"
                    style={{
                      transform: 'translate3d(0, 0, 0)',
                      willChange: 'transform',
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                    }}
                  />
                )"""

new_vid = """                {resolvedStyles.backgroundType === 'video' && (resolvedStyles.backgroundVideoUrl || slide.backgroundUrl || liveItem?.customBackgroundUrl) ? (
                  <div className="absolute inset-0 w-full h-full opacity-30 pointer-events-none z-0 overflow-hidden bg-black">
                    <LazyVideoThumbnail
                      src={(slide.backgroundUrl || liveItem?.customBackgroundUrl || resolvedStyles.backgroundVideoUrl) as string}
                      autoPlayOnHover={false}
                    />
                  </div>
                )"""

content = content.replace(old_vid, new_vid)

with open('src/components/LiveSlideCard.tsx', 'w') as f:
    f.write(content)

print("patched")
