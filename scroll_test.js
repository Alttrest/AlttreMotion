const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('pageerror', err => {
        console.error('PAGE ERROR:', err.message);
    });
    
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.error('PAGE CONSOLE ERROR:', msg.text());
        }
    });

    await page.goto('http://localhost:1242', { waitUntil: 'networkidle0' });
    
    // Simulate scroll to bottom
    await page.evaluate(() => {
        return new Promise((resolve) => {
            let totalHeight = 0;
            let distance = 100;
            let timer = setInterval(() => {
                let scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if(totalHeight >= scrollHeight){
                    clearInterval(timer);
                    resolve();
                }
            }, 50);
        });
    });

    // Simulate clicking 'design'
    await page.evaluate(() => {
        const btn = document.getElementById('btn-design');
        if (btn) btn.click();
    });

    await new Promise(r => setTimeout(r, 2000));

    console.log('Scroll and click test completed.');
    await browser.close();
})();
