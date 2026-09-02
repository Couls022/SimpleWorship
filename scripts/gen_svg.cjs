const fs = require('fs');

const svgIcon = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sw-blue" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8" />
      <stop offset="100%" stop-color="#2563EB" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#000000" flood-opacity="0.3"/>
    </filter>
  </defs>
  
  <g transform="translate(60, 140) skewX(-15) scale(1.2)">
    <!-- W -->
    <path d="M 150 0 L 190 140 L 230 0 L 290 0 L 220 200 L 160 200 L 130 60 L 100 200 L 40 200 L 110 0 Z" fill="url(#sw-blue)" />
    
    <!-- S Ribbon overlapping W -->
    <path d="M 160 0 L 70 0 C 30 0, 10 20, 10 50 C 10 70, 20 90, 60 90 L 110 90 C 130 90, 140 100, 140 120 C 140 140, 130 150, 110 150 L 0 150 L 0 200 L 110 200 C 160 200, 190 170, 190 130 C 190 90, 170 70, 120 70 L 70 70 C 50 70, 40 60, 40 50 C 40 40, 50 30, 70 30 L 160 30 Z" fill="#FFFFFF" filter="url(#shadow)" />
  </g>
</svg>
`;

const svgPrimary = `
<svg width="1000" height="200" viewBox="0 0 1000 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sw-blue" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8" />
      <stop offset="100%" stop-color="#2563EB" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.3"/>
    </filter>
  </defs>
  
  <g transform="translate(40, 50) skewX(-15) scale(0.6)">
    <!-- W -->
    <path d="M 150 0 L 190 140 L 230 0 L 290 0 L 220 200 L 160 200 L 130 60 L 100 200 L 40 200 L 110 0 Z" fill="url(#sw-blue)" />
    <!-- S -->
    <path d="M 160 0 L 70 0 C 30 0, 10 20, 10 50 C 10 70, 20 90, 60 90 L 110 90 C 130 90, 140 100, 140 120 C 140 140, 130 150, 110 150 L 0 150 L 0 200 L 110 200 C 160 200, 190 170, 190 130 C 190 90, 170 70, 120 70 L 70 70 C 50 70, 40 60, 40 50 C 40 40, 50 30, 70 30 L 160 30 Z" fill="#FFFFFF" filter="url(#shadow)" />
  </g>
  
  <text x="240" y="145" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="95" font-weight="500" fill="#FFFFFF" letter-spacing="-1">Simple<tspan font-weight="700" fill="#00BCD4">Worship</tspan></text>
</svg>
`;

const svgDark = `
<svg width="1000" height="200" viewBox="0 0 1000 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sw-blue" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8" />
      <stop offset="100%" stop-color="#2563EB" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.1"/>
    </filter>
  </defs>
  
  <g transform="translate(40, 50) skewX(-15) scale(0.6)">
    <!-- W -->
    <path d="M 150 0 L 190 140 L 230 0 L 290 0 L 220 200 L 160 200 L 130 60 L 100 200 L 40 200 L 110 0 Z" fill="url(#sw-blue)" />
    <!-- S -->
    <path d="M 160 0 L 70 0 C 30 0, 10 20, 10 50 C 10 70, 20 90, 60 90 L 110 90 C 130 90, 140 100, 140 120 C 140 140, 130 150, 110 150 L 0 150 L 0 200 L 110 200 C 160 200, 190 170, 190 130 C 190 90, 170 70, 120 70 L 70 70 C 50 70, 40 60, 40 50 C 40 40, 50 30, 70 30 L 160 30 Z" fill="#111827" filter="url(#shadow)" />
  </g>
  
  <text x="240" y="145" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="95" font-weight="500" fill="#111827" letter-spacing="-1">Simple<tspan font-weight="700" fill="#00BCD4">Worship</tspan></text>
</svg>
`;

fs.writeFileSync('public/branding/logo/SimpleWorship-icon.svg', svgIcon.trim());
fs.writeFileSync('public/branding/logo/SimpleWorship-SW-primary.svg', svgPrimary.trim());
fs.writeFileSync('public/branding/logo/SimpleWorship-SW-white.svg', svgPrimary.trim());
fs.writeFileSync('public/branding/logo/SimpleWorship-SW-dark.svg', svgDark.trim());
fs.writeFileSync('public/branding/logo/SimpleWorship-full.svg', svgPrimary.trim());
