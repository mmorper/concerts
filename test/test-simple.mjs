import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();

  console.log('Navigating to localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });

  console.log('Page loaded, taking screenshot...');
  await page.screenshot({ path: '/tmp/page-initial.png', fullPage: true });
  console.log('Screenshot saved: /tmp/page-initial.png');

  // Wait a bit and scroll to see if artist scene loads
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('Scrolling down...');
  await page.evaluate(() => {
    window.scrollBy(0, window.innerHeight * 2);
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  await page.screenshot({ path: '/tmp/page-scrolled.png', fullPage: true });
  console.log('Screenshot saved: /tmp/page-scrolled.png');

  console.log('\n✅ Check /tmp/page-*.png files');
  await browser.close();
})();
