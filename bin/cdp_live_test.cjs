const WebSocket = require('ws');
const http = require('http');

http.get('http://192.168.3.184:9226/json/list', (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', async () => {
    const list = JSON.parse(body);
    const target = list.find(t => t.url.includes('survey.exodus.pp.ua') || t.type === 'page');

    if (!target) {
      console.error('Target page not found in CDP list');
      process.exit(1);
    }

    console.log('Connecting to CDP target:', target.url);
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let id = 1;
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const msgId = id++;
        const timeout = setTimeout(() => {
          reject(new Error(`Timeout waiting for response to ${method}`));
        }, 15000);

        const handler = (data) => {
          const msg = JSON.parse(data);
          if (msg.id === msgId) {
            clearTimeout(timeout);
            ws.off('message', handler);
            resolve(msg.result);
          }
        };
        ws.on('message', handler);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    ws.on('open', async () => {
      console.log('Connected to CDP websocket');
      // Set auth cookie
      await send('Network.enable');
      await send('Network.setCookie', {
        name: 'astryx_k',
        value: 'oDWnckh7aaA8HOJiskM3uvvmUi7nQFX6',
        domain: 'survey.exodus.pp.ua',
        path: '/'
      });

      // Reload page to pick up latest build
      await send('Page.reload', { ignoreCache: true });
      await new Promise(r => setTimeout(r, 3000));

      const testResults = await send('Runtime.evaluate', {
        expression: `(async function() {
          const results = {};
          
          // 1. Check zoom label
          const zoomLabel = document.querySelector('[data-testid="viewport-zoom-label"]');
          results.initialZoom = zoomLabel ? zoomLabel.textContent.trim() : null;

          // Find zoom + button
          const buttons = Array.from(document.querySelectorAll('button'));
          const zoomInBtn = buttons.find(b => b.textContent.trim() === '+');
          
          if (zoomInBtn) {
            // Click + button with delays to reach 270%+
            for (let i = 0; i < 17; i++) {
              zoomInBtn.click();
              await new Promise(r => setTimeout(r, 60));
            }
          }

          const zoomLabelAfter = document.querySelector('[data-testid="viewport-zoom-label"]');
          results.zoomedLabel = zoomLabelAfter ? zoomLabelAfter.textContent.trim() : null;

          const inner = document.querySelector('[data-testid="viewport-canvas-inner"]');
          const container = inner ? inner.parentElement : null;

          if (container && inner) {
            results.containerClientWidth = container.clientWidth;
            results.containerScrollWidth = container.scrollWidth;
            results.innerRectWidth = Math.round(inner.getBoundingClientRect().width);
            results.innerWidthStyle = inner.style.width;
            results.innerMinWidthStyle = inner.style.minWidth;
            
            // Scroll to maximum right
            container.scrollLeft = container.scrollWidth;
            results.scrollLeftReached = container.scrollLeft;
            results.canScrollRight = container.scrollLeft > 0;
            results.scrollCoversFullWidth = container.scrollWidth >= (results.innerRectWidth - 15);
          }

          // 2. Test U2 - Focus / Fullscreen Mode & Correct Button
          const focusBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Фокус'));
          if (focusBtn) {
            focusBtn.click();
          }

          await new Promise(r => setTimeout(r, 500));
          const correctBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Виправити'));
          results.hasCorrectBtn = !!correctBtn;
          
          if (correctBtn) {
            correctBtn.click();
            await new Promise(r => setTimeout(r, 500));

            const correctionFormSubmit = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Надіслати виправлення'));
            const correctionFormCancel = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Скасувати'));
            const textareas = document.querySelectorAll('textarea');

            results.formOpened = !!correctionFormSubmit;
            results.formHasCancel = !!correctionFormCancel;
            results.textareaCount = textareas.length;

            if (correctionFormCancel) {
              correctionFormCancel.click();
            }
          }

          // 3. Test U4 - Step total display
          const stepInfo = Array.from(document.querySelectorAll('span')).find(s => s.textContent.includes('Крок'));
          results.stepInfoText = stepInfo ? stepInfo.textContent.trim() : null;

          return results;
        })()`,
        awaitPromise: true,
        returnByValue: true
      });

      console.log('LIVE CDP TEST RESULTS:\n', JSON.stringify(testResults.result.value, null, 2));

      const val = testResults.result.value;
      const zoomNum = parseInt(val.zoomedLabel.replace(/[^0-9]/g, ''), 10);
      const passU1 = val.canScrollRight && val.scrollCoversFullWidth && zoomNum >= 250;
      const passU2 = val.formOpened && val.formHasCancel;

      console.log('\n--- VERIFICATION GATES ---');
      console.log(`G3 (U1 Zoom > 100% full scrollWidth at 270%+): ${passU1 ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`G4 (U2 Fullscreen Correct button opens form): ${passU2 ? '✅ PASS' : '❌ FAIL'}`);

      ws.close();
      if (!passU1 || !passU2) {
        process.exit(1);
      }
    });

    ws.on('error', (err) => {
      console.error('CDP WebSocket error:', err);
      process.exit(1);
    });
  });
});
