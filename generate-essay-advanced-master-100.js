const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const puppeteer = require("puppeteer");

const rootDir = __dirname;
const commonPath = path.join(rootDir, "data", "prints.json");
const templatePath = path.join(rootDir, "template", "worksheet.html");
const tmpDir = path.join(rootDir, "tmp", "generated-html");

const themes = [
  ["university education", "大学教育", "大学教育は将来の成功にどのような役割を果たすか", "the role of university education in future success", ["education / 教育", "career / キャリア", "degree / 学位", "skill / 技能", "opportunity / 機会", "future / 将来"]],
  ["online classes", "オンライン授業", "オンライン授業は対面授業より効果的か", "whether online classes are more effective than face-to-face classes", ["online class / オンライン授業", "flexible / 柔軟な", "communication / 交流", "concentrate / 集中する", "technology / 技術", "learning outcome / 学習成果"]],
  ["artificial intelligence", "人工知能", "AIは人間の仕事を奪うより新しい仕事を生み出すか", "whether AI will create more jobs than it eliminates", ["AI / 人工知能", "automation / 自動化", "employment / 雇用", "productivity / 生産性", "innovation / 革新", "reskilling / 再教育"]],
  ["environmental protection", "環境保護", "経済成長より環境保護を優先すべきか", "whether environmental protection should be prioritized over economic growth", ["environment / 環境", "economic growth / 経済成長", "sustainable / 持続可能な", "pollution / 汚染", "resource / 資源", "future generation / 将来世代"]],
  ["smartphones at school", "学校でのスマートフォン", "学校でスマートフォンの使用を認めるべきか", "whether smartphones should be allowed at school", ["smartphone / スマートフォン", "school rule / 校則", "emergency / 緊急時", "distraction / 注意散漫", "learning / 学習", "responsibility / 責任"]],
  ["homework", "宿題", "宿題は学力向上に本当に必要か", "whether homework is necessary for academic improvement", ["homework / 宿題", "review / 復習", "stress / ストレス", "free time / 自由時間", "academic ability / 学力", "balance / バランス"]],
  ["school uniforms", "制服", "学校制服は必要か", "whether school uniforms are necessary", ["uniform / 制服", "equality / 平等", "identity / 一体感", "freedom / 自由", "cost / 費用", "school life / 学校生活"]],
  ["part-time jobs", "アルバイト", "高校生がアルバイトをすることの是非", "whether high school students should have part-time jobs", ["part-time job / アルバイト", "responsibility / 責任", "money / お金", "experience / 経験", "study time / 勉強時間", "workplace / 職場"]],
  ["reading books", "読書", "読書は若者にとって重要か", "whether reading books is important for young people", ["reading / 読書", "knowledge / 知識", "imagination / 想像力", "vocabulary / 語彙", "habit / 習慣", "digital media / デジタルメディア"]],
  ["traveling abroad", "海外旅行", "若者が海外旅行をすることの価値", "the value of traveling abroad for young people", ["travel abroad / 海外旅行", "culture / 文化", "language / 言語", "experience / 経験", "global view / 国際感覚", "independence / 自立"]],
  ["public transportation", "公共交通機関", "公共交通機関の利用を増やすべきか", "whether people should use public transportation more", ["public transportation / 公共交通", "traffic / 交通", "emission / 排出", "convenience / 利便性", "cost / 費用", "city planning / 都市計画"]],
  ["recycling", "リサイクル", "リサイクルをさらに推進すべきか", "whether recycling should be promoted further", ["recycling / リサイクル", "waste / ごみ", "plastic / プラスチック", "environment / 環境", "consumer / 消費者", "resource / 資源"]],
  ["renewable energy", "再生可能エネルギー", "再生可能エネルギーへの転換を急ぐべきか", "whether the shift to renewable energy should be accelerated", ["renewable energy / 再生可能エネルギー", "solar power / 太陽光", "wind power / 風力", "cost / 費用", "climate change / 気候変動", "energy security / エネルギー安全保障"]],
  ["plastic reduction", "プラスチック削減", "プラスチック製品の使用を減らすべきか", "whether plastic use should be reduced", ["plastic / プラスチック", "ocean / 海", "waste / ごみ", "reusable / 再利用可能な", "consumer / 消費者", "policy / 政策"]],
  ["climate change education", "気候変動教育", "学校で気候変動についてもっと教えるべきか", "whether schools should teach more about climate change", ["climate change / 気候変動", "education / 教育", "science / 科学", "future / 将来", "awareness / 意識", "action / 行動"]],
  ["volunteer work", "ボランティア", "学生はボランティア活動に参加すべきか", "whether students should participate in volunteer work", ["volunteer / ボランティア", "community / 地域", "empathy / 共感", "experience / 経験", "social contribution / 社会貢献", "growth / 成長"]],
  ["career education", "キャリア教育", "学校でキャリア教育を強化すべきか", "whether career education should be strengthened at school", ["career education / キャリア教育", "future job / 将来の仕事", "goal / 目標", "skill / 技能", "workplace / 職場", "choice / 選択"]],
  ["financial education", "金融教育", "学校でお金の使い方を教えるべきか", "whether financial education should be taught at school", ["financial education / 金融教育", "saving / 貯蓄", "budget / 予算", "investment / 投資", "consumer / 消費者", "independence / 自立"]],
  ["programming education", "プログラミング教育", "すべての学生がプログラミングを学ぶべきか", "whether all students should learn programming", ["programming / プログラミング", "logical thinking / 論理的思考", "technology / 技術", "future job / 将来の仕事", "creativity / 創造性", "problem solving / 問題解決"]],
  ["debate classes", "ディベート授業", "学校でディベートの機会を増やすべきか", "whether schools should offer more debate opportunities", ["debate / ディベート", "opinion / 意見", "critical thinking / 批判的思考", "speaking / 発話", "evidence / 根拠", "confidence / 自信"]],
  ["presentation skills", "プレゼン力", "学生にプレゼンテーション力は必要か", "whether presentation skills are necessary for students", ["presentation / 発表", "confidence / 自信", "communication / 交流", "idea / 考え", "workplace / 職場", "practice / 練習"]],
  ["school libraries", "学校図書館", "学校図書館は今後も必要か", "whether school libraries will remain necessary", ["library / 図書館", "book / 本", "research / 調査", "quiet space / 静かな場所", "digital resource / デジタル資料", "learning / 学習"]],
  ["e-books", "電子書籍", "電子書籍は紙の本より優れているか", "whether e-books are better than paper books", ["e-book / 電子書籍", "paper book / 紙の本", "screen / 画面", "portable / 持ち運びやすい", "reading / 読書", "library / 図書館"]],
  ["social media", "SNS", "SNSは若者に良い影響を与えるか", "whether social media has a positive effect on young people", ["social media / SNS", "communication / 交流", "privacy / プライバシー", "information / 情報", "mental health / 心の健康", "friendship / 友情"]],
  ["gaming", "ゲーム", "ゲームは教育に活用できるか", "whether games can be used for education", ["game / ゲーム", "education / 教育", "motivation / やる気", "problem solving / 問題解決", "screen time / 使用時間", "balance / バランス"]],
  ["screen time", "画面時間", "子どもの画面時間を制限すべきか", "whether children's screen time should be limited", ["screen time / 画面時間", "health / 健康", "sleep / 睡眠", "study / 勉強", "family rule / 家庭のルール", "digital habit / デジタル習慣"]],
  ["online shopping", "オンライン買い物", "オンラインショッピングは実店舗より便利か", "whether online shopping is more convenient than physical stores", ["online shopping / ネット通販", "store / 店舗", "delivery / 配送", "price / 価格", "choice / 選択肢", "consumer / 消費者"]],
  ["cashless payments", "キャッシュレス決済", "キャッシュレス決済をさらに広めるべきか", "whether cashless payments should spread further", ["cashless payment / キャッシュレス決済", "cash / 現金", "convenience / 利便性", "security / 安全性", "elderly people / 高齢者", "technology / 技術"]],
  ["remote work", "リモートワーク", "リモートワークは社会に良い影響を与えるか", "whether remote work has a positive impact on society", ["remote work / リモートワーク", "work-life balance / 仕事と生活の調和", "commuting / 通勤", "productivity / 生産性", "communication / 交流", "office / オフィス"]],
  ["four-day workweek", "週休3日", "週休3日制を導入すべきか", "whether a four-day workweek should be introduced", ["four-day workweek / 週休3日", "productivity / 生産性", "rest / 休息", "salary / 給料", "company / 会社", "work style / 働き方"]],
  ["elderly care", "高齢者介護", "高齢者介護にもっと社会的支援が必要か", "whether more social support is needed for elderly care", ["elderly care / 高齢者介護", "aging society / 高齢化社会", "family / 家族", "support / 支援", "welfare / 福祉", "community / 地域"]],
  ["childcare support", "子育て支援", "子育て支援を拡充すべきか", "whether childcare support should be expanded", ["childcare / 子育て", "support / 支援", "family / 家族", "work / 仕事", "birthrate / 出生率", "community / 地域"]],
  ["gender equality", "男女平等", "職場で男女平等は十分に進んでいるか", "whether gender equality has progressed enough in the workplace", ["gender equality / 男女平等", "workplace / 職場", "opportunity / 機会", "salary / 給料", "leadership / 指導力", "fairness / 公平性"]],
  ["foreign workers", "外国人労働者", "外国人労働者の受け入れを増やすべきか", "whether more foreign workers should be accepted", ["foreign worker / 外国人労働者", "labor shortage / 人手不足", "culture / 文化", "language / 言語", "economy / 経済", "integration / 共生"]],
  ["tourism", "観光", "観光客の増加は地域にとって良いことか", "whether an increase in tourists is good for local communities", ["tourism / 観光", "local economy / 地域経済", "culture / 文化", "overcrowding / 混雑", "environment / 環境", "visitor / 訪問者"]],
  ["local festivals", "地域のお祭り", "地域のお祭りを守るべきか", "whether local festivals should be preserved", ["local festival / 地域のお祭り", "tradition / 伝統", "community / 地域", "culture / 文化", "young people / 若者", "preserve / 守る"]],
  ["rural revitalization", "地方創生", "地方を活性化するために何が必要か", "what is needed to revitalize rural areas", ["rural area / 地方", "revitalization / 活性化", "population decline / 人口減少", "job / 仕事", "tourism / 観光", "community / 地域"]],
  ["city life", "都市生活", "都市で暮らすことは地方で暮らすことより良いか", "whether living in a city is better than living in a rural area", ["city / 都市", "rural area / 地方", "convenience / 利便性", "nature / 自然", "job / 仕事", "cost of living / 生活費"]],
  ["disaster prevention", "防災", "学校で防災教育を強化すべきか", "whether disaster prevention education should be strengthened at school", ["disaster prevention / 防災", "earthquake / 地震", "safety / 安全", "evacuation / 避難", "community / 地域", "preparedness / 備え"]],
  ["health education", "健康教育", "学校で健康教育をもっと重視すべきか", "whether health education should be emphasized more at school", ["health education / 健康教育", "exercise / 運動", "sleep / 睡眠", "food / 食事", "mental health / 心の健康", "habit / 習慣"]],
  ["breakfast habits", "朝食習慣", "朝食を毎日食べることは学生に必要か", "whether eating breakfast every day is necessary for students", ["breakfast / 朝食", "energy / 体力", "concentration / 集中", "health / 健康", "morning / 朝", "habit / 習慣"]],
  ["sleep", "睡眠", "学生は睡眠をもっと重視すべきか", "whether students should place more importance on sleep", ["sleep / 睡眠", "health / 健康", "memory / 記憶", "concentration / 集中", "stress / ストレス", "routine / 習慣"]],
  ["exercise", "運動", "毎日の運動は学習にも良い影響を与えるか", "whether daily exercise has a positive effect on learning", ["exercise / 運動", "health / 健康", "learning / 学習", "energy / 体力", "stress / ストレス", "habit / 習慣"]],
  ["school lunch", "学校給食", "学校給食は学生にとって必要か", "whether school lunch is necessary for students", ["school lunch / 学校給食", "nutrition / 栄養", "family / 家庭", "cost / 費用", "health / 健康", "equality / 平等"]],
  ["food waste", "食品ロス", "食品ロスを減らすために何をすべきか", "what should be done to reduce food waste", ["food waste / 食品ロス", "consumer / 消費者", "restaurant / 飲食店", "environment / 環境", "saving / 節約", "responsibility / 責任"]],
  ["animal rights", "動物の権利", "動物の権利をもっと守るべきか", "whether animal rights should be protected more", ["animal rights / 動物の権利", "welfare / 福祉", "zoo / 動物園", "research / 研究", "ethics / 倫理", "protection / 保護"]],
  ["zoos", "動物園", "動物園は教育に役立つか", "whether zoos are useful for education", ["zoo / 動物園", "education / 教育", "animal / 動物", "conservation / 保護", "nature / 自然", "family / 家族"]],
  ["pets", "ペット", "ペットを飼うことは子どもの成長に良いか", "whether having pets is good for children's development", ["pet / ペット", "responsibility / 責任", "kindness / 優しさ", "care / 世話", "family / 家族", "animal / 動物"]],
  ["space exploration", "宇宙開発", "宇宙開発に多くの予算を使うべきか", "whether large budgets should be spent on space exploration", ["space exploration / 宇宙開発", "budget / 予算", "science / 科学", "technology / 技術", "discovery / 発見", "priority / 優先事項"]],
  ["medical technology", "医療技術", "医療技術の進歩は社会をより良くするか", "whether advances in medical technology improve society", ["medical technology / 医療技術", "healthcare / 医療", "life expectancy / 平均寿命", "cost / 費用", "ethics / 倫理", "innovation / 革新"]],
  ["genetic engineering", "遺伝子技術", "遺伝子技術の利用を広げるべきか", "whether the use of genetic engineering should be expanded", ["genetic engineering / 遺伝子技術", "ethics / 倫理", "medicine / 医療", "food / 食料", "risk / 危険", "regulation / 規制"]],
  ["data privacy", "データプライバシー", "個人データの保護をもっと厳しくすべきか", "whether personal data protection should be stricter", ["data privacy / データプライバシー", "personal information / 個人情報", "company / 企業", "security / 安全性", "internet / インターネット", "trust / 信頼"]],
  ["facial recognition", "顔認証", "顔認証技術を公共の場で使うべきか", "whether facial recognition technology should be used in public places", ["facial recognition / 顔認証", "security / 安全", "privacy / プライバシー", "public place / 公共の場", "technology / 技術", "regulation / 規制"]],
  ["self-driving cars", "自動運転車", "自動運転車は社会に普及するべきか", "whether self-driving cars should become common in society", ["self-driving car / 自動運転車", "safety / 安全", "traffic / 交通", "technology / 技術", "accident / 事故", "elderly people / 高齢者"]],
  ["electric vehicles", "電気自動車", "電気自動車への移行を急ぐべきか", "whether the shift to electric vehicles should be accelerated", ["electric vehicle / 電気自動車", "emission / 排出", "battery / 電池", "charging station / 充電設備", "cost / 費用", "environment / 環境"]],
  ["bicycles", "自転車", "都市では自転車利用をもっと増やすべきか", "whether bicycle use should be increased in cities", ["bicycle / 自転車", "city / 都市", "traffic / 交通", "health / 健康", "safety / 安全", "environment / 環境"]],
  ["walking cities", "歩きやすい街", "歩きやすい街づくりを進めるべきか", "whether cities should become more walkable", ["walkable city / 歩きやすい街", "pedestrian / 歩行者", "health / 健康", "traffic / 交通", "urban planning / 都市計画", "safety / 安全"]],
  ["school trips", "修学旅行", "修学旅行は教育的価値があるか", "whether school trips have educational value", ["school trip / 修学旅行", "experience / 経験", "culture / 文化", "friendship / 友情", "learning / 学習", "memory / 思い出"]],
  ["club activities", "部活動", "部活動は学生生活に必要か", "whether club activities are necessary in student life", ["club activity / 部活動", "teamwork / 協力", "practice / 練習", "time / 時間", "friendship / 友情", "school life / 学校生活"]],
  ["competitive sports", "競技スポーツ", "学校で競技スポーツを重視すべきか", "whether competitive sports should be emphasized at school", ["competitive sport / 競技スポーツ", "teamwork / 協力", "pressure / プレッシャー", "health / 健康", "goal / 目標", "effort / 努力"]],
  ["arts education", "芸術教育", "芸術教育は主要教科と同じくらい重要か", "whether arts education is as important as core subjects", ["arts education / 芸術教育", "creativity / 創造性", "expression / 表現", "culture / 文化", "subject / 教科", "student / 学生"]],
  ["music education", "音楽教育", "音楽教育は学生の成長に役立つか", "whether music education helps students develop", ["music education / 音楽教育", "creativity / 創造性", "concentration / 集中", "culture / 文化", "emotion / 感情", "practice / 練習"]],
  ["handwriting", "手書き", "デジタル時代にも手書きの練習は必要か", "whether handwriting practice is still necessary in the digital age", ["handwriting / 手書き", "digital age / デジタル時代", "memory / 記憶", "skill / 技能", "computer / コンピューター", "note-taking / ノートを取ること"]],
  ["diaries", "日記", "日記を書くことは自己成長に役立つか", "whether keeping a diary helps personal growth", ["diary / 日記", "reflection / 振り返り", "writing / 書くこと", "emotion / 感情", "habit / 習慣", "growth / 成長"]],
  ["goal setting", "目標設定", "若者にとって目標を持つことは重要か", "whether having goals is important for young people", ["goal / 目標", "motivation / やる気", "effort / 努力", "future / 将来", "plan / 計画", "achievement / 達成"]],
  ["time management", "時間管理", "学生は時間管理を学ぶべきか", "whether students should learn time management", ["time management / 時間管理", "schedule / 予定", "study / 勉強", "free time / 自由時間", "priority / 優先順位", "habit / 習慣"]],
  ["teamwork", "チームワーク", "チームで学ぶことは一人で学ぶことより効果的か", "whether learning in teams is more effective than learning alone", ["teamwork / チームワーク", "cooperation / 協力", "communication / 交流", "idea / 考え", "responsibility / 責任", "learning / 学習"]],
  ["leadership", "リーダーシップ", "学校でリーダーシップを学ぶ機会は必要か", "whether students need opportunities to learn leadership at school", ["leadership / リーダーシップ", "responsibility / 責任", "team / チーム", "decision / 決定", "confidence / 自信", "experience / 経験"]],
  ["failure", "失敗", "失敗から学ぶ経験は成功より重要か", "whether learning from failure is more important than success", ["failure / 失敗", "success / 成功", "experience / 経験", "growth / 成長", "challenge / 挑戦", "lesson / 教訓"]],
  ["competition", "競争", "競争は学生の成長に必要か", "whether competition is necessary for students' growth", ["competition / 競争", "motivation / やる気", "stress / ストレス", "growth / 成長", "effort / 努力", "fairness / 公平性"]],
  ["cooperation", "協力", "協力する力は学力と同じくらい重要か", "whether cooperation skills are as important as academic ability", ["cooperation / 協力", "academic ability / 学力", "team / チーム", "communication / 交流", "society / 社会", "skill / 技能"]],
  ["school rules", "校則", "校則はもっと柔軟にするべきか", "whether school rules should be more flexible", ["school rule / 校則", "freedom / 自由", "safety / 安全", "responsibility / 責任", "student / 生徒", "flexible / 柔軟な"]],
  ["long vacations", "長期休暇", "学校の長期休暇はもっと長くするべきか", "whether school vacations should be longer", ["vacation / 休暇", "school / 学校", "rest / 休息", "homework / 宿題", "travel / 旅行", "learning loss / 学習の遅れ"]],
  ["year-round school", "通年制学校", "通年制の学校制度を導入すべきか", "whether year-round schooling should be introduced", ["year-round school / 通年制学校", "vacation / 休暇", "learning / 学習", "schedule / 予定", "family / 家族", "system / 制度"]],
  ["exams", "試験", "試験は学生の能力を正しく測れるか", "whether exams can accurately measure students' abilities", ["exam / 試験", "ability / 能力", "stress / ストレス", "fairness / 公平性", "study / 勉強", "assessment / 評価"]],
  ["entrance exams", "入学試験", "入学試験中心の教育を見直すべきか", "whether education centered on entrance exams should be reconsidered", ["entrance exam / 入学試験", "education / 教育", "pressure / 圧力", "fairness / 公平性", "creativity / 創造性", "student / 学生"]],
  ["grades", "成績", "成績で学生を評価することは公平か", "whether grading students is fair", ["grade / 成績", "fairness / 公平性", "effort / 努力", "ability / 能力", "motivation / やる気", "assessment / 評価"]],
  ["AI tutoring", "AI学習支援", "AIによる学習支援は先生の役割を変えるか", "whether AI tutoring will change the role of teachers", ["AI tutoring / AI学習支援", "teacher / 先生", "personalized learning / 個別学習", "technology / 技術", "support / 支援", "future / 将来"]],
  ["translation apps", "翻訳アプリ", "翻訳アプリの普及で外国語学習は不要になるか", "whether translation apps will make foreign language learning unnecessary", ["translation app / 翻訳アプリ", "foreign language / 外国語", "communication / 会話", "technology / 技術", "learning / 学習", "culture / 文化"]],
  ["English speaking", "英語スピーキング", "日本の学生は英語を話す練習をもっと増やすべきか", "whether Japanese students should practice speaking English more", ["English speaking / 英語スピーキング", "practice / 練習", "confidence / 自信", "communication / 会話", "grammar / 文法", "global / 国際的な"]],
  ["foreign culture", "異文化理解", "異文化理解は現代社会で重要か", "whether cross-cultural understanding is important in modern society", ["foreign culture / 異文化", "understanding / 理解", "respect / 尊重", "global society / 国際社会", "communication / 交流", "diversity / 多様性"]],
  ["immigration", "移民", "移民の受け入れは社会に利益をもたらすか", "whether accepting immigrants benefits society", ["immigration / 移民", "labor / 労働力", "culture / 文化", "integration / 共生", "economy / 経済", "diversity / 多様性"]],
  ["population decline", "人口減少", "人口減少に社会はどう対応すべきか", "how society should respond to population decline", ["population decline / 人口減少", "aging society / 高齢化社会", "labor shortage / 人手不足", "technology / 技術", "community / 地域", "policy / 政策"]],
  ["taxes", "税金", "社会福祉のために増税は必要か", "whether tax increases are necessary for social welfare", ["tax / 税金", "welfare / 福祉", "public service / 公共サービス", "burden / 負担", "fairness / 公平性", "government / 政府"]],
  ["universal basic income", "ベーシックインカム", "ベーシックインカムを導入すべきか", "whether universal basic income should be introduced", ["universal basic income / ベーシックインカム", "poverty / 貧困", "work / 仕事", "tax / 税金", "security / 安心", "policy / 政策"]],
  ["income inequality", "所得格差", "所得格差を減らすために政府は何をすべきか", "what governments should do to reduce income inequality", ["income inequality / 所得格差", "government / 政府", "education / 教育", "tax / 税金", "opportunity / 機会", "fairness / 公平性"]],
  ["free university", "大学無償化", "大学教育を無償化すべきか", "whether university education should be free", ["free university / 大学無償化", "tuition / 授業料", "tax / 税金", "opportunity / 機会", "student loan / 奨学金", "society / 社会"]],
  ["healthcare access", "医療アクセス", "すべての人が安価な医療を受けられるべきか", "whether everyone should have access to affordable healthcare", ["healthcare / 医療", "access / 利用機会", "cost / 費用", "equality / 平等", "government / 政府", "life / 命"]],
  ["mental health", "メンタルヘルス", "学校でメンタルヘルス支援を強化すべきか", "whether mental health support should be strengthened at school", ["mental health / 心の健康", "support / 支援", "stress / ストレス", "counselor / カウンセラー", "student / 学生", "well-being / 幸福"]],
  ["bullying prevention", "いじめ防止", "いじめを防ぐために学校は何をすべきか", "what schools should do to prevent bullying", ["bullying / いじめ", "school / 学校", "support / 支援", "communication / 交流", "rule / ルール", "safety / 安全"]],
  ["community safety", "地域の安全", "地域の安全を守るために住民の協力は必要か", "whether residents' cooperation is necessary to keep communities safe", ["community safety / 地域の安全", "resident / 住民", "cooperation / 協力", "crime prevention / 防犯", "trust / 信頼", "neighborhood / 近所"]],
  ["public cameras", "防犯カメラ", "公共の場所に防犯カメラを増やすべきか", "whether more security cameras should be installed in public places", ["security camera / 防犯カメラ", "public place / 公共の場", "safety / 安全", "privacy / プライバシー", "crime / 犯罪", "technology / 技術"]],
  ["news literacy", "ニュースリテラシー", "若者はニュースの読み方を学ぶべきか", "whether young people should learn news literacy", ["news literacy / ニュースリテラシー", "information / 情報", "fake news / 偽情報", "critical thinking / 批判的思考", "internet / インターネット", "society / 社会"]],
  ["advertising", "広告", "広告は消費者に悪い影響を与えることが多いか", "whether advertising often has a negative effect on consumers", ["advertising / 広告", "consumer / 消費者", "choice / 選択", "information / 情報", "influence / 影響", "company / 企業"]],
  ["influencers", "インフルエンサー", "インフルエンサーは若者の良い手本になるか", "whether influencers can be good role models for young people", ["influencer / インフルエンサー", "young people / 若者", "role model / 手本", "social media / SNS", "influence / 影響", "responsibility / 責任"]],
  ["sports events", "スポーツイベント", "大きなスポーツイベントは開催地に利益をもたらすか", "whether major sports events benefit host cities", ["sports event / スポーツイベント", "host city / 開催都市", "tourism / 観光", "cost / 費用", "economy / 経済", "legacy / 遺産"]],
  ["Olympics", "オリンピック", "オリンピック開催は国にとって価値があるか", "whether hosting the Olympics is worthwhile for a country", ["Olympics / オリンピック", "host country / 開催国", "cost / 費用", "international exchange / 国際交流", "athlete / 選手", "economy / 経済"]],
  ["traditional culture", "伝統文化", "伝統文化を守るために学校教育は役立つか", "whether school education helps preserve traditional culture", ["traditional culture / 伝統文化", "preserve / 守る", "school education / 学校教育", "history / 歴史", "identity / 独自性", "young people / 若者"]],
  ["museums", "博物館", "博物館は現代社会で重要な役割を持つか", "whether museums have an important role in modern society", ["museum / 博物館", "history / 歴史", "education / 教育", "culture / 文化", "visitor / 来館者", "preserve / 保存する"]],
  ["local products", "地元産品", "地元産品をもっと買うべきか", "whether people should buy more local products", ["local product / 地元産品", "economy / 経済", "fresh / 新鮮な", "transportation / 輸送", "community / 地域", "consumer / 消費者"]],
  ["water conservation", "節水", "水資源を守るために節水を徹底すべきか", "whether water conservation should be practiced more strictly", ["water conservation / 節水", "resource / 資源", "climate change / 気候変動", "daily life / 日常生活", "responsibility / 責任", "future / 将来"]],
  ["forest protection", "森林保護", "森林保護を経済活動より優先すべきか", "whether forest protection should be prioritized over economic activities", ["forest protection / 森林保護", "biodiversity / 生物多様性", "economic activity / 経済活動", "climate / 気候", "resource / 資源", "conservation / 保全"]],
  ["ocean pollution", "海洋汚染", "海洋汚染を防ぐために国際協力は必要か", "whether international cooperation is necessary to prevent ocean pollution", ["ocean pollution / 海洋汚染", "international cooperation / 国際協力", "plastic waste / プラスチックごみ", "marine life / 海洋生物", "policy / 政策", "responsibility / 責任"]],
  ["sustainable fashion", "持続可能なファッション", "ファッション産業は持続可能性を重視すべきか", "whether the fashion industry should focus on sustainability", ["sustainable fashion / 持続可能なファッション", "clothing / 衣服", "consumer / 消費者", "waste / 廃棄物", "industry / 産業", "environment / 環境"]],
  ["food self-sufficiency", "食料自給率", "食料自給率を高めるべきか", "whether food self-sufficiency should be increased", ["food self-sufficiency / 食料自給率", "agriculture / 農業", "import / 輸入", "security / 安全保障", "farmer / 農家", "food supply / 食料供給"]],
  ["urban farming", "都市農業", "都市農業をもっと広げるべきか", "whether urban farming should be expanded", ["urban farming / 都市農業", "city / 都市", "food / 食料", "community / 地域", "green space / 緑地", "sustainability / 持続可能性"]],
  ["remote medicine", "オンライン診療", "オンライン診療をさらに普及させるべきか", "whether online medical consultations should become more common", ["online medical consultation / オンライン診療", "doctor / 医師", "patient / 患者", "access / 利用機会", "technology / 技術", "privacy / プライバシー"]],
  ["lifelong learning", "生涯学習", "大人になってからも学び続けることは必要か", "whether lifelong learning is necessary for adults", ["lifelong learning / 生涯学習", "adult / 大人", "skill / 技能", "career / キャリア", "society / 社会", "growth / 成長"]]
];

const configs = [
  {
    prefix: "E",
    stage: "Essay",
    title: "短いエッセイ（150語程度）",
    lead: "与えられたテーマについて、構成に沿って英語で書きましょう。",
    word_count: "130〜170語",
    structure: ["導入", "本論", "結論"],
    sidebar: ["導入でテーマの背景を書く", "本論で理由と具体例を書く", "結論で自分の意見をまとめる"],
    writing_lines: 14,
    word_tips: [["130語未満", "内容がやや不足しているかも"], ["130〜170語", "ちょうど良いボリューム！"], ["170語超え", "簡潔にまとめる練習も大切！"]],
    outputDir: path.join(rootDir, "output", "pdf", "E-1~E-100"),
    outputName: "E-1~E-100.pdf"
  },
  {
    prefix: "A",
    stage: "Advanced",
    title: "英検準1級レベルのエッセイ（180〜200語）",
    lead: "与えられたテーマについて、論理的に意見を述べ、理由を示し、結論を導きましょう。",
    word_count: "180〜200語",
    structure: ["意見", "理由①", "理由②", "結論"],
    sidebar: ["意見を明確に述べる", "理由を2つ挙げる", "具体例や説明を加える", "接続詞を使って論理的につなげる"],
    writing_lines: 16,
    word_tips: [["140語未満", "内容が不足しているかも"], ["180〜200語", "ちょうど良いボリューム！"], ["200語超え", "簡潔にまとめる練習も大切！"]],
    outputDir: path.join(rootDir, "output", "pdf", "A-1~A-100"),
    outputName: "A-1~A-100.pdf"
  },
  {
    prefix: "M",
    stage: "Master",
    title: "英検1級レベルのエッセイ（250語程度）",
    lead: "与えられたテーマについて、深く掘り下げ、論理的に展開し、説得力のある英語でエッセイを書きましょう。",
    word_count: "240〜260語",
    structure: ["導入", "本論①", "本論②", "反対意見", "結論"],
    sidebar: ["立場を明確にする", "具体例や根拠を使う", "反対意見にも触れる", "再反論を入れる", "結論で主張を強める"],
    writing_lines: 18,
    word_tips: [["240語未満", "内容が不足しているかも"], ["240〜260語", "ちょうど良いボリューム！"], ["260語超え", "簡潔にまとめる練習も大切！"]],
    outputDir: path.join(rootDir, "output", "pdf", "M-1~M-100"),
    outputName: "M-1~M-100.pdf"
  }
];

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

function phrasesFor(config, keywords) {
  const common = {
    "関連語句の例": keywords
  };
  if (config.prefix === "E") {
    return {
      "導入の表現": ["In recent years, ～", "Nowadays, ～", "It is often said that ～", "This essay will discuss ～"],
      "理由を述べる表現": ["One reason is that ～", "For example, ～", "This means that ～", "Another point is ～"],
      "結論の表現": ["In conclusion, ～", "To sum up, ～", "Therefore, I think ～", "For these reasons, ～"],
      ...common
    };
  }
  if (config.prefix === "A") {
    return {
      "意見を述べる表現": ["I believe that ～", "In my opinion, ～", "I am convinced that ～", "From my perspective, ～"],
      "理由を述べる表現": ["One reason is that ～", "Another reason is that ～", "A key factor is ～", "This is because ～"],
      "結論を述べる表現": ["In conclusion, ～", "To sum up, ～", "Therefore, I believe that ～", "Looking ahead, ～"],
      ...common
    };
  }
  return {
    "導入の表現": ["In recent years, ～", "It is widely argued that ～", "The issue of ～ has become increasingly important.", "There is no doubt that ～"],
    "理由を述べる表現": ["One compelling reason is that ～", "A key factor is that ～", "This is evidenced by the fact that ～", "For instance, ～"],
    "反対意見への対応": ["Some people argue that ～", "However, this view overlooks ～", "While it is true that ～, it is also important to consider ～", "Nevertheless, ～"],
    ...common
  };
}

function topicFor(config, theme) {
  const [key, jpName, jpCore, enCore, keywords] = theme;
  if (config.prefix === "E") {
    return {
      topic_jp: `${jpName}について、あなたの意見を述べなさい。`,
      topic_en: `Write your opinion about ${enCore}.`
    };
  }
  if (config.prefix === "A") {
    return {
      topic_jp: `${jpCore}について、あなたの意見と2つの理由を述べなさい。`,
      topic_en: `Do you think ${enCore}? Give two reasons to support your opinion.`
    };
  }
  return {
    topic_jp: `${jpCore}。この考えに賛成か反対か、具体例を用いて論じなさい。`,
    topic_en: `Agree or disagree: ${capitalize(enCore)}. Use specific examples to support your position.`
  };
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function makePrint(config, theme, index) {
  const [, , , , keywords] = theme;
  return {
    code: `${config.prefix}-${index + 1}`,
    stage: config.stage,
    title: config.title,
    lead: config.lead,
    word_count: config.word_count,
    structure: config.structure,
    sidebar: config.sidebar,
    writing_lines: config.writing_lines,
    word_tips: config.word_tips,
    phrases: phrasesFor(config, keywords),
    ...topicFor(config, theme)
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

function combinedHtml(template, pages, title) {
  const style = extractStyle(template);
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
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

async function generateBatch(browser, template, common, config) {
  fs.mkdirSync(config.outputDir, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  const prints = themes.slice(0, 100).map((theme, index) => makePrint(config, theme, index));
  const pages = prints.map((print) => extractMain(render(template, print, common)));
  const htmlPath = path.join(tmpDir, `${config.prefix}-1~${config.prefix}-100.html`);
  const pdfPath = path.join(config.outputDir, config.outputName);
  fs.writeFileSync(htmlPath, combinedHtml(template, pages, `${config.prefix}-1〜${config.prefix}-100 英作文 毎日プリント`), "utf8");

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
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
    timeout: 120000
  });
  await page.close();
  console.log(`Generated ${path.relative(rootDir, pdfPath)}`);
}

async function main() {
  if (themes.length < 100) {
    throw new Error(`Expected at least 100 themes, got ${themes.length}.`);
  }

  const common = JSON.parse(fs.readFileSync(commonPath, "utf8")).common;
  const template = fs.readFileSync(templatePath, "utf8");
  const executablePath = findBrowserExecutable();
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    ...(executablePath ? { executablePath } : {})
  });

  try {
    for (const config of configs) {
      await generateBatch(browser, template, common, config);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
