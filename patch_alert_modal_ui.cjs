const fs = require('fs');
let code = fs.readFileSync('src/components/AlertModal.tsx', 'utf8');

// Main Form Scrolling UI
const mainScrollingUI = `
              <div>
                <label className="text-gray-400 block mb-1 font-semibold text-[11px]">Movement</label>
                <select
                  value={scrolling ? 'marquee' : 'static'}
                  onChange={(e) => setScrolling(e.target.value === 'marquee')}
                  className="w-full bg-[#13151b] border border-[#2f3444] rounded-lg px-2.5 py-1.5 text-xs text-gray-200 cursor-pointer"
                >
                  <option value="marquee">Scrolling Marquee</option>
                  <option value="static">Static Centered</option>
                </select>
              </div>
`;

code = code.replace(
  "              <div>\n                <label className=\"text-gray-400 block mb-1 font-semibold text-[11px]\">Text Color</label>",
  mainScrollingUI + "              <div>\n                <label className=\"text-gray-400 block mb-1 font-semibold text-[11px]\">Text Color</label>"
);

// Edit Form Scrolling UI
const editScrollingUI = `
                      <div>
                        <label className="text-[10px] text-gray-400 font-semibold block mb-0.5">Movement:</label>
                        <select
                          value={editForm.scrolling ? 'marquee' : 'static'}
                          onChange={(e) => setEditForm({ ...editForm, scrolling: e.target.value === 'marquee' })}
                          className="w-full bg-[#11131a] border border-[#373c4e] rounded px-2 py-1 text-xs text-white"
                        >
                          <option value="marquee">Scrolling Marquee</option>
                          <option value="static">Static Centered</option>
                        </select>
                      </div>
`;

code = code.replace(
  "                      {/* Colors in Edit Form */}",
  editScrollingUI + "                      {/* Colors in Edit Form */}"
);

fs.writeFileSync('src/components/AlertModal.tsx', code);
