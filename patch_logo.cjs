const fs = require('fs');
let file = fs.readFileSync('src/components/ProjectorView.tsx', 'utf8');

file = file.replace(
  /const \[localBackgroundUrl, setLocalBackgroundUrl\] = useState<string>\(''\);/,
  "const [localBackgroundUrl, setLocalBackgroundUrl] = useState<string>('');\n  const [localLogoUrl, setLocalLogoUrl] = useState<string>('');"
);

const resolveAdd = `    resolveUrl(resolvedStyles.logoUrl || logoStyles.logoUrl || '', undefined).then(resolved => {
      if (isMounted) {
        setLocalLogoUrl(resolved);
      }
    });`;

file = file.replace(
  /resolveUrl\(audioSrc, activeItem\?\.contentId\)\.then\(resolved => \{/,
  resolveAdd + '\n    resolveUrl(audioSrc, activeItem?.contentId).then(resolved => {'
);

file = file.replace(/logoStyles\.logoUrl/g, "localLogoUrl");
file = file.replace(/resolvedStyles\.logoUrl/g, "localLogoUrl");

fs.writeFileSync('src/components/ProjectorView.tsx', file);
console.log('Patched logoUrl');
