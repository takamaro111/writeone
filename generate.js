const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const puppeteer = require("puppeteer");

const rootDir = __dirname;
const dataPath = path.join(rootDir, "data", "prints.json");
const templatePath = path.join(rootDir, "template", "worksheet.html");
const outputDir = path.join(rootDir, "output", "pdf");
const tmpDir = path.join(rootDir, "tmp", "generated-html");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function listItems(items) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function writingRows(print) {
  const labels = print.structure.slice();
  const labelPositions = new Map(
    labels.map((label, index) => [Math.floor((index * print.writing_lines) / labels.length), label])
  );
  const rows = [];
  for (let index = 0; index < print.writing_lines; index += 1) {
    const label = labelPositions.has(index) ? `<span>${escapeHtml(labelPositions.get(index))}</span>` : "";
    rows.push(`<div class="writing-line">${label}</div>`);
  }
  return rows.join("");
}

function phraseGroups(groups) {
  return Object.entries(groups)
    .map(([heading, items]) => {
      const rows = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
      return `<div class="phrase-group"><div class="phrase-heading">【${escapeHtml(heading)}】</div><ul class="phrase-list">${rows}</ul></div>`;
    })
    .join("");
}

function wordTips(print) {
  return print.word_tips
    .map(([range, message]) => `<tr><td>${escapeHtml(range)}</td><td>：</td><td>${escapeHtml(message)}</td></tr>`)
    .join("");
}

function render(template, print, common) {
  const replacements = {
    code: escapeHtml(print.code),
    stage: escapeHtml(print.stage),
    title: escapeHtml(print.title),
    lead: escapeHtml(print.lead),
    topic_jp: escapeHtml(print.topic_jp),
    topic_en: escapeHtml(print.topic_en),
    word_count: escapeHtml(print.word_count),
    writing_lines: print.writing_lines,
    heading: escapeHtml(common.heading),
    subheading: escapeHtml(common.subheading),
    footer: escapeHtml(common.footer),
    memo_items: listItems([
      ...print.sidebar,
      `目標語数は ${print.word_count} です`
    ]),
    checklist_items: listItems(common.checklist),
    feedback_items: listItems(common.feedback),
    sidebar_items: listItems(print.sidebar),
    structure_items: listItems(print.structure),
    phrase_groups: phraseGroups(print.phrases),
    word_tip_rows: wordTips(print),
    writing_rows: writingRows(print)
  };

  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, key) => {
    if (!(key in replacements)) {
      throw new Error(`Missing template value: ${key}`);
    }
    return String(replacements[key]);
  });
}

function findBrowserExecutable() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate));
}

async function main() {
  const raw = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const template = fs.readFileSync(templatePath, "utf8");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  const executablePath = findBrowserExecutable();
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    ...(executablePath ? { executablePath } : {})
  });

  try {
    for (const print of raw.prints) {
      const html = render(template, print, raw.common);
      const htmlPath = path.join(tmpDir, `${print.code}.html`);
      const pdfPath = path.join(outputDir, `${print.code}.pdf`);
      fs.writeFileSync(htmlPath, html, "utf8");

      const page = await browser.newPage();
      await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
      await Promise.race([
        page.evaluateHandle("document.fonts.ready"),
        new Promise((resolve) => setTimeout(resolve, 2000))
      ]);
      await page.pdf({
        path: pdfPath,
        format: "A4",
        landscape: false,
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" }
      });
      await page.close();
      console.log(`Generated ${path.relative(rootDir, pdfPath)}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
