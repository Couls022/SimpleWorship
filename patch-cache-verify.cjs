const fs = require('fs');
let code = fs.readFileSync('src/utils/SlideRenderCache.ts', 'utf8');

code = code.replace(
  `      this.cache.set(key, {
        status: 'ready',
        frame
      });

      if (base64Url && typeof window !== 'undefined') {`,
  `      this.cache.set(key, {
        status: 'ready',
        frame
      });

      const verification = this.cache.get(key);
      console.log('[SlideRenderCache] 🔍 Cache Write Verification:', { 
        putSuccess: true, 
        getSuccess: !!verification && verification.status === 'ready' && !!verification.frame 
      });

      if (base64Url && typeof window !== 'undefined') {`
);

fs.writeFileSync('src/utils/SlideRenderCache.ts', code);
