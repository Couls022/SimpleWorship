const fs = require('fs');
const file = 'src/components/common/SystemFontPicker.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add createPortal
if (!content.includes('createPortal')) {
  content = content.replace("import React, { useState, useEffect, useRef } from 'react';", "import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';\nimport { createPortal } from 'react-dom';");
}
if (!content.includes('useLayoutEffect')) {
  content = content.replace("import React, { useState, useEffect, useRef }", "import React, { useState, useEffect, useRef, useLayoutEffect }");
}

// Add state for position
if (!content.includes('dropdownStyle')) {
  content = content.replace(
    "const [visibleLimit, setVisibleLimit] = useState(50);",
    "const [visibleLimit, setVisibleLimit] = useState(50);\n  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});"
  );
}

// Add layout effect
if (!content.includes('updateDropdownPosition')) {
  content = content.replace(
    "useEffect(() => {",
    `const updateDropdownPosition = () => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width > 288 ? rect.width : 288,
        zIndex: 1000000
      });
    }
  };

  useLayoutEffect(() => {
    updateDropdownPosition();
    if (isOpen) {
      window.addEventListener('scroll', updateDropdownPosition, true);
      window.addEventListener('resize', updateDropdownPosition);
    }
    return () => {
      window.removeEventListener('scroll', updateDropdownPosition, true);
      window.removeEventListener('resize', updateDropdownPosition);
    };
  }, [isOpen]);

  useEffect(() => {`
  );
}

// Replace the render of the dropdown
if (content.includes('absolute top-full')) {
  content = content.replace(
    /<div className="absolute top-full left-0 mt-1 w-72 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 overflow-hidden flex flex-col text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-100">/,
    `{typeof document !== 'undefined' && createPortal(
      <div 
        className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden flex flex-col text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-100"
        style={dropdownStyle}
        onClick={(e) => e.stopPropagation()}
      >`
  );
  
  // Close the portal wrapper
  content = content.replace(
    /No fonts found matching "{searchQuery}"\n              <\/div>\n            \)}\n          <\/div>\n        <\/div>\n      \)}\n    <\/div>/,
    `No fonts found matching "{searchQuery}"
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
      )}
    </div>`
  );
}

fs.writeFileSync(file, content);
