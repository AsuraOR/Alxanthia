const { execSync } = require('child_process');

try {
  const dom = execSync(`"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --headless=new --disable-gpu --virtual-time-budget=5000 --dump-dom "http://localhost:8080/tests/browser-runner.html"`, {
    encoding: 'utf8',
    timeout: 10000
  });

  const match = dom.match(/<pre id="results">([\s\S]*?)<\/pre>/);
  if (match) {
    console.log('======================================================================');
    console.log('REAL-BROWSER TEST EXECUTION (CHROME HEADLESS)');
    console.log('======================================================================');
    console.log(match[1].trim());
    console.log('======================================================================');
    if (match[1].includes('FAIL') || match[1].includes('EXCEPTION')) {
      process.exit(1);
    }
  } else {
    console.log('No results found in DOM:');
    console.log(dom.slice(0, 500));
  }
} catch (err) {
  console.error('Error running browser runner:', err.message);
  process.exit(1);
}
