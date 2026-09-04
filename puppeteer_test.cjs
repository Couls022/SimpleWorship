const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ 
    executablePath: '/root/.cache/puppeteer/chrome/linux-133.0.6943.53/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`CONSOLE ERROR: ${msg.text()}`);
    }
  });
  
  page.on('pageerror', err => {
    console.log(`PAGE ERROR: ${err.message}`);
  });
  
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));
  } catch (err) {
    console.error(`GOTO ERROR: ${err.message}`);
  }
  
  await browser.close();
})();
