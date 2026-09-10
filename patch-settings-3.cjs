const fs = require('fs');

let code = fs.readFileSync('src/components/SettingsModal.tsx', 'utf8');

const addRouterForm = `
                  <h4 className="font-bold text-gray-200 mb-3">Add New Output Router</h4>
                  <form onSubmit={handleAddGroup} className="grid grid-cols-2 gap-4 items-end">
                    <div className="flex flex-col gap-1">
                      <label className="text-gray-400">Name</label>
                      <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="e.g. Stage Display 2" className="bg-[#1c1f26] border border-[#2d313d] rounded p-2 text-white outline-none" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-gray-400">Role</label>
                      <select value={newGroupRole} onChange={e => setNewGroupRole(e.target.value as any)} className="bg-[#1c1f26] border border-[#2d313d] rounded p-2 text-white outline-none">
                        <option value="primary">Primary Projector</option>
                        <option value="confidence">Confidence Monitor</option>
                        <option value="broadcast">Live Stream / Broadcast</option>
                        <option value="lobby">Lobby Display</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-gray-400">Aspect Ratio</label>
                      <select value={newGroupAspectRatio} onChange={e => setNewGroupAspectRatio(e.target.value as any)} className="bg-[#1c1f26] border border-[#2d313d] rounded p-2 text-white outline-none">
                        <option value="16:9">16:9 Widescreen</option>
                        <option value="4:3">4:3 Standard</option>
                        <option value="16:10">16:10 Computer</option>
                        <option value="21:9">21:9 Ultrawide</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-gray-400">Target Display</label>
                      <select value={newGroupDisplayId} onChange={e => setNewGroupDisplayId(e.target.value)} className="bg-[#1c1f26] border border-[#2d313d] rounded p-2 text-white outline-none">
                        <option value="">(None / Windowed)</option>
                        {screens.map(s => (
                          <option key={s.id || s.label || s.name} value={s.id || s.label || s.name}>
                            {s.label || s.name || 'Display'} ({s.width}x{s.height})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2 mt-2">
                      <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded p-2 font-bold flex justify-center items-center gap-2">
                        <Plus size={16} /> Add Router
                      </button>
                    </div>
                  </form>
`;

code = code.replace(/<h4 className="font-bold text-gray-200 mb-3">Add New Output Router<\/h4>[\s\S]*?<\/form>/, addRouterForm);

code = code.replace(
  /const \[newGroupRole, setNewGroupRole\] = useState<'primary' \| 'confidence' \| 'broadcast' \| 'lobby'>\('confidence'\);/,
  `const [newGroupRole, setNewGroupRole] = useState<'primary' | 'confidence' | 'broadcast' | 'lobby'>('confidence');
  const [newGroupAspectRatio, setNewGroupAspectRatio] = useState('16:9');
  const [newGroupDisplayId, setNewGroupDisplayId] = useState('');`
);

code = code.replace(
  /aspectRatio: '16:9',/,
  `aspectRatio: newGroupAspectRatio as any,
      targetDisplayId: newGroupDisplayId || undefined,`
);

code = code.replace(
  /\| Aspect Ratio: \{group\.aspectRatio\}/,
  `| Aspect Ratio: {group.aspectRatio} | Target: {group.targetDisplayId || 'Windowed'}`
);

fs.writeFileSync('src/components/SettingsModal.tsx', code);
console.log('patched settings modal 3');
