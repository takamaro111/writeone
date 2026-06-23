const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const puppeteer = require("puppeteer");

function findBrowserExecutable() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate));
}

async function main() {
  const htmlPath = path.resolve(__dirname, "index.html");
  const outputPath = path.resolve(__dirname, "TOEIC_Daily_Print_A12.pdf");
  const executablePath = findBrowserExecutable();
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    ...(executablePath ? { executablePath } : {}),
  });

  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(htmlPath).href, {
      waitUntil: "load",
    });
    await Promise.race([
      page.evaluateHandle("document.fonts.ready"),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
    await page.pdf({
      path: outputPath,
      format: "A4",
      landscape: false,
      printBackground: true,
      preferCSSPageSize: true,
    });
    console.log(`PDF generated: ${outputPath}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
