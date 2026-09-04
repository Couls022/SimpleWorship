const fs = require('fs');
let code = fs.readFileSync('src/components/LivePanel.tsx', 'utf8');

// Replace showPreviewDisplay=false list container
let target1 = `<div className="space-y-1.5">
              {slides.map((slide, idx) => {`;
let replace1 = `<div 
              className="grid gap-1.5"
              style={{ gridTemplateColumns: viewMode === 'summary' ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))' }}
            >
              {slides.map((slide, idx) => {`;

if(code.includes(target1)) {
  code = code.replace(target1, replace1);
  console.log("Replaced target1");
}

let target1b = `className={\`flex cursor-pointer transition-all \${
                      viewMode === 'summary' 
                        ? 'py-0.5 border-b border-[#22242c]' 
                        : 'border rounded-md overflow-hidden shadow-xs'
                    }`;
// already does not have mb-1 in the first block

// Replace showPreviewDisplay=true list container
let target2 = `                  ) : (
                    slides.map((slide, idx) => {`;
let replace2 = `                  ) : (
                    <div 
                      className="p-1.5 grid gap-1.5"
                      style={{ gridTemplateColumns: viewMode === 'summary' ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))' }}
                    >
                    {slides.map((slide, idx) => {`;

if(code.includes(target2)) {
  code = code.replace(target2, replace2);
  console.log("Replaced target2");
}

let target2b = `                      return (
                        <div
                          key={slide.id || idx}
                          onClick={() => handleSelectSlide(idx)}
                          className={\`flex cursor-pointer transition-all \${
                            viewMode === 'summary' 
                              ? 'py-0.5 border-b border-[#22242c]' 
                              : 'mb-1 border rounded-md overflow-hidden shadow-xs mx-1 first:mt-1'
                          }`;
let replace2b = `                      return (
                        <div
                          key={slide.id || idx}
                          onClick={() => handleSelectSlide(idx)}
                          className={\`flex cursor-pointer transition-all \${
                            viewMode === 'summary' 
                              ? 'py-0.5 border-b border-[#22242c]' 
                              : 'border rounded-md overflow-hidden shadow-xs'
                          }`;

if(code.includes(target2b)) {
  code = code.replace(target2b, replace2b);
  console.log("Replaced target2b");
}

// Ensure the closing div is added for target2 replacement
let target2c = `                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Panel>`;
let replace2c = `                        </div>
                      </div>
                    );
                  })}
                  </div>
                )}
              </div>
            </Panel>`;
if(code.includes(target2c)) {
  code = code.replace(target2c, replace2c);
  console.log("Replaced target2c");
}

fs.writeFileSync('src/components/LivePanel.tsx', code);
console.log("DONE");
