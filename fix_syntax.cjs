const fs = require('fs');
let code = fs.readFileSync('src/components/LivePanel.tsx', 'utf8');

const t = `                  );
                })
              )}
            </div>
          </div>
        ) : (`;
const r = `                  );
                })}
                </div>
              )}
            </div>
          </div>
        ) : (`;

code = code.replace(t, r);
fs.writeFileSync('src/components/LivePanel.tsx', code);
