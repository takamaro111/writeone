const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const puppeteer = require("puppeteer");

const rootDir = __dirname;
const dataPath = path.join(rootDir, "data", "opinion-o1-o10.json");
const commonPath = path.join(rootDir, "data", "prints.json");
const templatePath = path.join(rootDir, "template", "worksheet.html");
const outputDir = path.join(rootDir, "output", "pdf", "O-1~O-100");
const tmpDir = path.join(rootDir, "tmp", "generated-html");
const outputPath = path.join(outputDir, "O-1~O-10.pdf");
const combinedHtmlPath = path.join(tmpDir, "O-1~O-10.html");

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
  const labelPositions = new Map(
    print.structure.map((label, index) => [Math.floor((index * print.writing_lines) / print.structure.length), label])
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
    memo_items: listItems([...print.sidebar, `目標語数は ${print.word_count} です`]),
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

function makeOpinionPrint(rawPrint) {
  return {
    stage: "Opinion",
    title: "意見文（50〜80語）",
    lead: "あなたの意見とその理由を英語で書きましょう。",
    word_count: "50〜80語",
    structure: ["意見", "理由"],
    sidebar: [
      "自分の意見を最初に書く",
      "理由を1つ具体的に書く",
      "簡単な単語でも自分の言葉で書く"
    ],
    writing_lines: 10,
    word_tips: [
      ["50語未満", "もう少し具体的に書き足そう！"],
      ["50〜80語", "ちょうど良いボリューム！"],
      ["80語超え", "簡潔にまとめる練習も大切！"]
    ],
    ...rawPrint
  };
}

function extractStyle(template) {
  const match = template.match(/<style>([\s\S]*?)<\/style>/);
  if (!match) {
    throw new Error("Template style block was not found.");
  }
  return match[1];
}

function extractMain(html) {
  const match = html.match(/<main class="page"[\s\S]*?<\/main>/);
  if (!match) {
    throw new Error("Rendered page main block was not found.");
  }
  return match[0];
}

function combinedHtml(template, pages) {
  const style = extractStyle(template);
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>O-1〜O-10 英作文 毎日プリント</title>
  <style>
${style}
    .page {
      break-after: page;
      page-break-after: always;
    }

    .page:last-child {
      break-after: auto;
      page-break-after: auto;
    }

    @media print {
      body {
        background: #fff;
      }
    }
  </style>
</head>
<body>
${pages.join("\n")}
</body>
</html>`;
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
  const opinionData = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const commonData = JSON.parse(fs.readFileSync(commonPath, "utf8")).common;
  const template = fs.readFileSync(templatePath, "utf8");

  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  const pages = opinionData.prints.map((rawPrint) => {
    const print = makeOpinionPrint(rawPrint);
    return extractMain(render(template, print, commonData));
  });

  fs.writeFileSync(combinedHtmlPath, combinedHtml(template, pages), "utf8");

  const executablePath = findBrowserExecutable();
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    ...(executablePath ? { executablePath } : {})
  });

  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(combinedHtmlPath).href, { waitUntil: "load" });
    await Promise.race([
      page.evaluateHandle("document.fonts.ready"),
      new Promise((resolve) => setTimeout(resolve, 2000))
    ]);
    await page.pdf({
      path: outputPath,
      format: "A4",
      landscape: false,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" }
    });
    console.log(`Generated ${path.relative(rootDir, outputPath)}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
