const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function extractArray(source, name) {
  const startToken = `const ${name} = [`;
  const start = source.indexOf(startToken);
  if (start === -1) throw new Error(`Cannot find ${name}`);
  const arrayStart = source.indexOf("[", start);
  let depth = 0;
  let inString = false;
  let quote = "";
  let escape = false;
  for (let i = arrayStart; i < source.length; i += 1) {
    const char = source[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === "\\") {
        escape = true;
      } else if (char === quote) {
        inString = false;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      inString = true;
      quote = char;
      continue;
    }
    if (char === "[") depth += 1;
    if (char === "]") depth -= 1;
    if (depth === 0) {
      return vm.runInNewContext(`(${source.slice(arrayStart, i + 1)})`);
    }
  }
  throw new Error(`Unclosed array ${name}`);
}

const baseOpinion = JSON.parse(read("data/opinion-o1-o10.json")).prints;
const opinionScript = read("generate-opinion-o1-o100.js");
const additionalOpinion = extractArray(opinionScript, "additionalTopics").map(([code, topic_jp, topic_en, keywords]) => ({
  code,
  topic_jp,
  topic_en,
  keywords
}));

const writingScript = read("generate-essay-advanced-master-100.js");
const themes = extractArray(writingScript, "themes").slice(0, 100);

const configs = {
  Opinion: {
    prefix: "O",
    title: "意見文（50〜80語）",
    wordCountMin: 50,
    wordCountMax: 80,
    structure: ["意見", "理由"],
    tips: ["自分の意見を最初に書く", "理由を1つ具体的に書く", "簡単な単語でも自分の言葉で書く"]
  },
  Essay: {
    prefix: "E",
    title: "短いエッセイ（150語程度）",
    wordCountMin: 130,
    wordCountMax: 170,
    structure: ["導入", "本論", "結論"],
    tips: ["導入でテーマの背景を書く", "本論で理由と具体例を書く", "結論で自分の意見をまとめる"]
  },
  Advanced: {
    prefix: "A",
    title: "英検準1級レベルのエッセイ（180〜200語）",
    wordCountMin: 180,
    wordCountMax: 200,
    structure: ["意見", "理由①", "理由②", "結論"],
    tips: ["意見を明確に述べる", "理由を2つ挙げる", "具体例や説明を加える", "接続詞を使って論理的につなげる"]
  },
  Master: {
    prefix: "M",
    title: "英検1級レベルのエッセイ（250語程度）",
    wordCountMin: 240,
    wordCountMax: 260,
    structure: ["導入", "本論①", "本論②", "反対意見", "結論"],
    tips: ["立場を明確にする", "具体例や根拠を使う", "反対意見にも触れる", "再反論を入れる", "結論で主張を強める"]
  }
};

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function topicFor(level, theme) {
  const [, jpName, jpCore, enCore] = theme;
  if (level === "Essay") {
    return {
      topicJp: `${jpName}について、あなたの意見を述べなさい。`,
      topicEn: `Write your opinion about ${enCore}.`
    };
  }
  if (level === "Advanced") {
    return {
      topicJp: `${jpCore}について、あなたの意見と2つの理由を述べなさい。`,
      topicEn: `Do you think ${enCore}? Give two reasons to support your opinion.`
    };
  }
  return {
    topicJp: `${jpCore}。この考えに賛成か反対か、具体例を用いて論じなさい。`,
    topicEn: `Agree or disagree: ${capitalize(enCore)}. Use specific examples to support your position.`
  };
}

function pdfUrl(prefix, code) {
  return `/pdf/${prefix}-1~${prefix}-100/${code}.pdf`;
}

const records = [];

for (const raw of [...baseOpinion, ...additionalOpinion]) {
  const config = configs.Opinion;
  const keywords = raw.keywords ?? Object.values(raw.phrases ?? {}).flat();
  records.push({
    id: raw.code,
    code: raw.code,
    level: "Opinion",
    title: config.title,
    topicJp: raw.topic_jp,
    topicEn: raw.topic_en,
    wordCountMin: config.wordCountMin,
    wordCountMax: config.wordCountMax,
    structure: config.structure,
    tips: [...config.tips, `関連語句: ${keywords.slice(0, 6).join(", ")}`],
    pdfUrl: pdfUrl(config.prefix, raw.code),
    sortOrder: Number(raw.code.split("-")[1]),
    isPublished: true
  });
}

for (const level of ["Essay", "Advanced", "Master"]) {
  const config = configs[level];
  themes.forEach((theme, index) => {
    const code = `${config.prefix}-${index + 1}`;
    const topic = topicFor(level, theme);
    records.push({
      id: code,
      code,
      level,
      title: config.title,
      topicJp: topic.topicJp,
      topicEn: topic.topicEn,
      wordCountMin: config.wordCountMin,
      wordCountMax: config.wordCountMax,
      structure: config.structure,
      tips: [...config.tips, `関連語句: ${theme[4].join(", ")}`],
      pdfUrl: pdfUrl(config.prefix, code),
      sortOrder: index + 1,
      isPublished: true
    });
  });
}

if (records.length !== 400) {
  throw new Error(`Expected 400 records, got ${records.length}`);
}

const outPath = path.join(root, "src", "data", "printRecords.json");
fs.writeFileSync(outPath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
console.log(`Wrote ${records.length} records to ${path.relative(root, outPath)}`);
