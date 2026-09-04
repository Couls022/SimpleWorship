const https = require('https');
const fs = require('fs');
const path = require('path');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchUrl(res.headers.location));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function run() {
  console.log('Fetching KJV...');
  const kjvRaw = await fetchUrl('https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json');
  console.log('Fetched KJV size:', kjvRaw.length);

  console.log('Fetching Tagalog XML...');
  const tagRaw = await fetchUrl('https://raw.githubusercontent.com/seven1m/open-bibles/master/tgl-tagalog.osis.xml');
  console.log('Fetched Tagalog XML size:', tagRaw.length);

  fs.writeFileSync(path.join(__dirname, 'kjv_fetched.json'), kjvRaw);
  fs.writeFileSync(path.join(__dirname, 'tagalog_fetched.xml'), tagRaw);
  console.log('Saved raw files to scripts/');
}

run().catch(e => console.error(e));
