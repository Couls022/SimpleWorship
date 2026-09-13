const fs = require('fs');
let code = fs.readFileSync('src/components/MonitorPreviewCanvas.tsx', 'utf8');

const search = `
                  <PptxRenderOverlay
                    fileBytes={activeItem?.data?.fileBytes}
                    contentId={activeItem?.contentId}
                    activeSlideIndex={presentationState.activeSlideIndex || 0}
                  />
`;

const replace = `
                  <PptxRenderOverlay
                    fileBytes={activeItem?.data?.fileBytes}
                    contentId={activeItem?.contentId}
                    activeSlideIndex={presentationState.activeSlideIndex || 0}
                    pptxAction={presentationState.pptxAction}
                    pptxActionTimestamp={presentationState.pptxActionTimestamp}
                    onActiveSlideChange={(index) => {
                       useStore.getState().setStagedGroupState(groupId || 'group-congregation', {
                          activeSlideIndex: index,
                          pptxAction: null,
                       });
                    }}
                  />
`;

code = code.replace(search.trim(), replace.trim());
fs.writeFileSync('src/components/MonitorPreviewCanvas.tsx', code);
