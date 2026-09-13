const fs = require('fs');
let code = fs.readFileSync('tailwind.config.ts', 'utf8');

const themeExtend = `      animation: {
        'marquee': 'marquee 15s linear infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(-100%)' },
        }
      },`;

code = code.replace(
  "    extend: {",
  "    extend: {\n" + themeExtend
);

fs.writeFileSync('tailwind.config.ts', code);
