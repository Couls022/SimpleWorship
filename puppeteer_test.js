const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`${msg.type().toUpperCase()}: ${msg.text()}`);
    }
  });
  
  page.on('pageerror', err => {
    console.log(`PAGE ERROR: ${err.message}`);
  });
  
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 30000 });
    // wait a few more seconds just in case
    await new Promise(r => setTimeout(r, 3000));
  } catch (err) {
    console.error(`GOTO ERROR: ${err.message}`);
  }
  
  await browser.close();
})();
