import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outputDir = path.resolve('./screenshots');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const widths = [320, 360, 375, 390, 412, 768, 1024];
const pages = [
  { name: 'Home', url: 'http://localhost:3000/#/' },
  { name: 'Search', url: 'http://localhost:3000/#/search/smartphone' },
  { name: 'Product', url: 'http://localhost:3000/#/product/demo?title=Apple%20iPhone%2016%20128GB&brand=Apple&price=74900' },
  { name: 'Profile-Login', url: 'http://localhost:3000/#/profile' },
  { name: 'Contact', url: 'http://localhost:3000/#/contact' },
  { name: 'Forgot-Password', url: 'http://localhost:3000/forgot-password.html' }
];

async function run() {
  console.log('Launching Edge for mobile responsiveness verification...');
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = [];

  for (const pageInfo of pages) {
    for (const width of widths) {
      const page = await browser.newPage();
      await page.setViewport({ width, height: 800, deviceScaleFactor: 1 });
      try {
        await page.goto(pageInfo.url, { waitUntil: 'networkidle0', timeout: 15000 });
      } catch {
        // fallback if networkidle0 takes too long
      }
      await new Promise(r => setTimeout(r, 800));

      const overflow = await page.evaluate(() => {
        const docEl = document.documentElement;
        const body = document.body;
        const scrollWidth = Math.max(docEl.scrollWidth, body.scrollWidth);
        const clientWidth = docEl.clientWidth;
        const innerWidth = window.innerWidth;
        const hasOverflow = scrollWidth > innerWidth + 1; // 1px tolerance
        return {
          scrollWidth,
          clientWidth,
          innerWidth,
          hasOverflow
        };
      });

      // Save screenshot for key test widths: 360, 390, 768
      if ([360, 390, 768].includes(width)) {
        const shotPath = path.join(outputDir, `${pageInfo.name}-${width}px.png`);
        await page.screenshot({ path: shotPath, fullPage: false });
      }

      results.push({
        page: pageInfo.name,
        width,
        ...overflow,
        status: overflow.hasOverflow ? 'OVERFLOW_FAIL' : 'PASS'
      });

      await page.close();
    }
  }

  await browser.close();

  console.log('\n--- VERIFICATION RESULTS ---');
  console.table(results.map(r => ({
    Page: r.page,
    Width: `${r.width}px`,
    ScrollWidth: `${r.scrollWidth}px`,
    InnerWidth: `${r.innerWidth}px`,
    Status: r.status
  })));

  const failures = results.filter(r => r.status !== 'PASS');
  if (failures.length === 0) {
    console.log('\n✅ ALL PAGES PASSED! Zero horizontal overflow detected across all widths.');
  } else {
    console.log(`\n❌ Detected ${failures.length} overflow failures.`);
  }
}

run().catch(console.error);
