import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (request.url().includes('supabase.co/rest/v1/')) {
      console.log('--- SUPABASE REQUEST ---');
      console.log('URL:', request.url());
      console.log('Method:', request.method());
    }
    request.continue();
  });
  
  page.on('response', async response => {
    if (response.url().includes('supabase.co/rest/v1/')) {
      console.log('--- SUPABASE RESPONSE ---');
      console.log('Status:', response.status());
      try {
        const text = await response.text();
        console.log('Body length:', text.length);
        if (text.length < 500) {
          console.log('Body:', text);
        } else {
          console.log('Body (truncated):', text.substring(0, 500) + '...');
        }
      } catch (e) {
        console.log('Could not read body');
      }
    }
  });

  console.log('Navigating to http://localhost:8080/twinning...');
  await page.goto('http://localhost:8080/twinning', { waitUntil: 'networkidle0' });
  
  console.log('Done.');
  await browser.close();
})();
