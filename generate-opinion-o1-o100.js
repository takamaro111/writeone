const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const puppeteer = require("puppeteer");

const rootDir = __dirname;
const baseDataPath = path.join(rootDir, "data", "opinion-o1-o10.json");
const commonPath = path.join(rootDir, "data", "prints.json");
const templatePath = path.join(rootDir, "template", "worksheet.html");
const outputDir = path.join(rootDir, "output", "pdf", "O-1~O-100");
const tmpDir = path.join(rootDir, "tmp", "generated-html");
const outputPath = path.join(outputDir, "O-1~O-100.pdf");
const combinedHtmlPath = path.join(tmpDir, "O-1~O-100.html");

const additionalTopics = [
  ["O-11", "昼食は学校で出されるべきだと思いますか？", "Do you think lunch should be provided at school?", ["lunch / 昼食", "school / 学校", "healthy / 健康的な", "cost / 費用", "students / 生徒", "meal / 食事"]],
  ["O-12", "テストは学生にとって必要だと思いますか？", "Do you think tests are necessary for students?", ["test / テスト", "student / 学生", "knowledge / 知識", "pressure / プレッシャー", "study / 勉強", "result / 結果"]],
  ["O-13", "放課後に部活動をすることは大切だと思いますか？", "Do you think after-school club activities are important?", ["club activity / 部活動", "teamwork / 協力", "friendship / 友情", "skill / 技能", "practice / 練習", "school life / 学校生活"]],
  ["O-14", "高校生はアルバイトをするべきだと思いますか？", "Do you think high school students should have part-time jobs?", ["part-time job / アルバイト", "money / お金", "responsibility / 責任", "experience / 経験", "time / 時間", "study / 勉強"]],
  ["O-15", "家族と夕食を食べることは大切だと思いますか？", "Do you think eating dinner with family is important?", ["family / 家族", "dinner / 夕食", "conversation / 会話", "relationship / 関係", "home / 家", "important / 大切な"]],
  ["O-16", "ペットを飼うことは子どもに良い影響を与えると思いますか？", "Do you think having a pet is good for children?", ["pet / ペット", "children / 子ども", "responsibility / 責任", "kindness / 優しさ", "care / 世話", "animal / 動物"]],
  ["O-17", "自転車で通学することは良いと思いますか？", "Do you think going to school by bicycle is a good idea?", ["bicycle / 自転車", "school / 学校", "exercise / 運動", "safe / 安全な", "environment / 環境", "commute / 通学"]],
  ["O-18", "週末は家で過ごすほうがよいと思いますか？", "Do you think it is better to spend weekends at home?", ["weekend / 週末", "home / 家", "relax / 休む", "family / 家族", "hobby / 趣味", "outside / 外"]],
  ["O-19", "音楽を聴きながら勉強することは良いと思いますか？", "Do you think studying while listening to music is a good idea?", ["music / 音楽", "study / 勉強", "concentrate / 集中する", "relax / リラックスする", "noise / 音", "habit / 習慣"]],
  ["O-20", "学校でタブレットを使うべきだと思いますか？", "Do you think students should use tablets at school?", ["tablet / タブレット", "technology / 技術", "class / 授業", "convenient / 便利な", "paper / 紙", "learning / 学習"]],
  ["O-21", "外国語を学ぶことは将来役に立つと思いますか？", "Do you think learning a foreign language is useful for the future?", ["foreign language / 外国語", "future / 将来", "job / 仕事", "travel / 旅行", "communication / 会話", "useful / 役に立つ"]],
  ["O-22", "毎日運動することは必要だと思いますか？", "Do you think exercising every day is necessary?", ["exercise / 運動", "health / 健康", "energy / 体力", "habit / 習慣", "body / 体", "daily / 毎日の"]],
  ["O-23", "ゲームをする時間を制限するべきだと思いますか？", "Do you think time spent playing games should be limited?", ["game / ゲーム", "time limit / 時間制限", "health / 健康", "study / 勉強", "fun / 楽しみ", "balance / バランス"]],
  ["O-24", "SNSは友人関係に良いと思いますか？", "Do you think social media is good for friendships?", ["social media / SNS", "friendship / 友情", "message / メッセージ", "communication / 交流", "problem / 問題", "online / オンライン"]],
  ["O-25", "都市に住むほうが田舎に住むよりよいと思いますか？", "Do you think living in a city is better than living in the countryside?", ["city / 都市", "countryside / 田舎", "convenient / 便利な", "nature / 自然", "job / 仕事", "life / 生活"]],
  ["O-26", "買い物はオンラインでするほうがよいと思いますか？", "Do you think shopping online is better?", ["online shopping / ネット通販", "store / 店", "convenient / 便利な", "price / 価格", "delivery / 配達", "choice / 選択肢"]],
  ["O-27", "現金より電子マネーを使うほうがよいと思いますか？", "Do you think using electronic money is better than using cash?", ["electronic money / 電子マネー", "cash / 現金", "payment / 支払い", "convenient / 便利な", "safe / 安全な", "money / お金"]],
  ["O-28", "紙の本より電子書籍のほうがよいと思いますか？", "Do you think e-books are better than paper books?", ["e-book / 電子書籍", "paper book / 紙の本", "reading / 読書", "light / 軽い", "screen / 画面", "library / 図書館"]],
  ["O-29", "学校で料理を学ぶべきだと思いますか？", "Do you think students should learn cooking at school?", ["cooking / 料理", "school / 学校", "life skill / 生活技能", "food / 食べ物", "health / 健康", "independent / 自立した"]],
  ["O-30", "毎日ニュースを見ることは大切だと思いますか？", "Do you think watching the news every day is important?", ["news / ニュース", "society / 社会", "world / 世界", "information / 情報", "important / 大切な", "daily / 毎日の"]],
  ["O-31", "学生はボランティア活動をするべきだと思いますか？", "Do you think students should do volunteer work?", ["volunteer / ボランティア", "community / 地域", "help / 助ける", "experience / 経験", "kindness / 優しさ", "society / 社会"]],
  ["O-32", "学校の授業はもっと短くするべきだと思いますか？", "Do you think school classes should be shorter?", ["class / 授業", "shorter / より短い", "concentration / 集中", "break / 休憩", "student / 生徒", "learn / 学ぶ"]],
  ["O-33", "毎日同じ時間に寝ることは大切だと思いますか？", "Do you think going to bed at the same time every day is important?", ["sleep / 睡眠", "bedtime / 就寝時間", "health / 健康", "routine / 習慣", "morning / 朝", "energy / 元気"]],
  ["O-34", "学校で金融について学ぶべきだと思いますか？", "Do you think students should learn about money at school?", ["money / お金", "finance / 金融", "saving / 貯金", "shopping / 買い物", "future / 将来", "skill / 技能"]],
  ["O-35", "写真を撮ることは良い趣味だと思いますか？", "Do you think taking photos is a good hobby?", ["photo / 写真", "hobby / 趣味", "memory / 思い出", "creative / 創造的な", "camera / カメラ", "share / 共有する"]],
  ["O-36", "公共交通機関をもっと使うべきだと思いますか？", "Do you think people should use public transportation more?", ["public transportation / 公共交通", "train / 電車", "bus / バス", "environment / 環境", "traffic / 交通", "convenient / 便利な"]],
  ["O-37", "朝食を毎日食べることは大切だと思いますか？", "Do you think eating breakfast every day is important?", ["breakfast / 朝食", "energy / 元気", "health / 健康", "morning / 朝", "study / 勉強", "meal / 食事"]],
  ["O-38", "学校に図書館は必要だと思いますか？", "Do you think schools need libraries?", ["library / 図書館", "book / 本", "study / 勉強", "quiet / 静かな", "knowledge / 知識", "school / 学校"]],
  ["O-39", "友だちと一緒に勉強するほうがよいと思いますか？", "Do you think studying with friends is better?", ["friend / 友だち", "study / 勉強", "help / 助ける", "motivation / やる気", "alone / 一人で", "understand / 理解する"]],
  ["O-40", "学校でプレゼンテーションをする機会は必要だと思いますか？", "Do you think students need chances to give presentations at school?", ["presentation / 発表", "speaking / 話すこと", "confidence / 自信", "class / 授業", "idea / 考え", "practice / 練習"]],
  ["O-41", "外国へ旅行することは若者に良いと思いますか？", "Do you think traveling abroad is good for young people?", ["abroad / 海外", "travel / 旅行", "culture / 文化", "language / 言語", "experience / 経験", "young people / 若者"]],
  ["O-42", "動物園は必要だと思いますか？", "Do you think zoos are necessary?", ["zoo / 動物園", "animal / 動物", "education / 教育", "protect / 守る", "nature / 自然", "family / 家族"]],
  ["O-43", "制服のない学校のほうがよいと思いますか？", "Do you think schools without uniforms are better?", ["uniform / 制服", "clothes / 服", "freedom / 自由", "school / 学校", "rule / ルール", "student / 生徒"]],
  ["O-44", "日本の学生はもっと英語で話す練習をするべきだと思いますか？", "Do you think Japanese students should practice speaking English more?", ["English / 英語", "speaking / 話すこと", "practice / 練習", "communication / 会話", "confidence / 自信", "student / 学生"]],
  ["O-45", "夏休みはもっと長いほうがよいと思いますか？", "Do you think summer vacation should be longer?", ["summer vacation / 夏休み", "longer / より長い", "rest / 休み", "homework / 宿題", "travel / 旅行", "school / 学校"]],
  ["O-46", "学校で掃除をすることは大切だと思いますか？", "Do you think cleaning at school is important?", ["cleaning / 掃除", "school / 学校", "responsibility / 責任", "teamwork / 協力", "clean / 清潔な", "habit / 習慣"]],
  ["O-47", "手紙を書くことは今でも大切だと思いますか？", "Do you think writing letters is still important?", ["letter / 手紙", "message / メッセージ", "feeling / 気持ち", "communication / 交流", "traditional / 伝統的な", "important / 大切な"]],
  ["O-48", "映画館で映画を見るほうが家で見るよりよいと思いますか？", "Do you think watching movies at a theater is better than watching them at home?", ["movie theater / 映画館", "home / 家", "screen / 画面", "sound / 音", "experience / 体験", "cost / 費用"]],
  ["O-49", "学生は新聞を読むべきだと思いますか？", "Do you think students should read newspapers?", ["newspaper / 新聞", "news / ニュース", "information / 情報", "society / 社会", "reading / 読むこと", "student / 学生"]],
  ["O-50", "スポーツを見るよりするほうがよいと思いますか？", "Do you think playing sports is better than watching sports?", ["sport / スポーツ", "watch / 見る", "play / する", "health / 健康", "team / チーム", "fun / 楽しい"]],
  ["O-51", "学校でプログラミングを学ぶべきだと思いますか？", "Do you think students should learn programming at school?", ["programming / プログラミング", "computer / コンピューター", "future / 将来", "skill / 技能", "technology / 技術", "problem solving / 問題解決"]],
  ["O-52", "リサイクルはもっと広めるべきだと思いますか？", "Do you think recycling should be promoted more?", ["recycling / リサイクル", "environment / 環境", "waste / ごみ", "plastic / プラスチック", "earth / 地球", "protect / 守る"]],
  ["O-53", "早くから将来の仕事について考えるべきだと思いますか？", "Do you think students should think about their future jobs early?", ["future job / 将来の仕事", "career / 職業", "goal / 目標", "student / 学生", "choice / 選択", "plan / 計画"]],
  ["O-54", "学校で芸術を学ぶことは大切だと思いますか？", "Do you think studying art at school is important?", ["art / 芸術", "creative / 創造的な", "school / 学校", "feeling / 感情", "culture / 文化", "expression / 表現"]],
  ["O-55", "毎日日記を書くことは良い習慣だと思いますか？", "Do you think keeping a diary every day is a good habit?", ["diary / 日記", "habit / 習慣", "writing / 書くこと", "memory / 思い出", "feeling / 気持ち", "daily / 毎日の"]],
  ["O-56", "水筒を持ち歩くことは良いと思いますか？", "Do you think carrying a water bottle is a good idea?", ["water bottle / 水筒", "water / 水", "health / 健康", "environment / 環境", "cost / 費用", "convenient / 便利な"]],
  ["O-57", "学校でディベートをするべきだと思いますか？", "Do you think students should have debates at school?", ["debate / ディベート", "opinion / 意見", "reason / 理由", "speaking / 話すこと", "thinking / 思考", "class / 授業"]],
  ["O-58", "有名人は良いお手本になると思いますか？", "Do you think famous people can be good role models?", ["famous person / 有名人", "role model / お手本", "effort / 努力", "influence / 影響", "dream / 夢", "behavior / 行動"]],
  ["O-59", "学校でスマートフォンを使うことを許可するべきだと思いますか？", "Do you think smartphones should be allowed at school?", ["smartphone / スマートフォン", "school / 学校", "rule / ルール", "emergency / 緊急", "study / 学習", "distraction / 気が散るもの"]],
  ["O-60", "手書きの練習は今でも必要だと思いますか？", "Do you think handwriting practice is still necessary?", ["handwriting / 手書き", "practice / 練習", "computer / コンピューター", "letter / 文字", "skill / 技能", "necessary / 必要な"]],
  ["O-61", "地域のお祭りは大切だと思いますか？", "Do you think local festivals are important?", ["local festival / 地域のお祭り", "community / 地域", "culture / 文化", "tradition / 伝統", "people / 人々", "fun / 楽しい"]],
  ["O-62", "学校にカフェテリアがあるとよいと思いますか？", "Do you think schools should have cafeterias?", ["cafeteria / 食堂", "school / 学校", "lunch / 昼食", "choice / 選択肢", "healthy / 健康的な", "convenient / 便利な"]],
  ["O-63", "一人で過ごす時間は大切だと思いますか？", "Do you think spending time alone is important?", ["alone / 一人で", "time / 時間", "relax / 休む", "think / 考える", "hobby / 趣味", "important / 大切な"]],
  ["O-64", "家で勉強するほうが図書館で勉強するよりよいと思いますか？", "Do you think studying at home is better than studying at a library?", ["home / 家", "library / 図書館", "quiet / 静かな", "concentrate / 集中する", "study / 勉強", "comfortable / 快適な"]],
  ["O-65", "学校で外国の文化を学ぶべきだと思いますか？", "Do you think students should learn about foreign cultures at school?", ["foreign culture / 外国文化", "world / 世界", "understand / 理解する", "language / 言語", "school / 学校", "respect / 尊重"]],
  ["O-66", "子どもは外で遊ぶ時間を増やすべきだと思いますか？", "Do you think children should spend more time playing outside?", ["outside / 外", "children / 子ども", "exercise / 運動", "nature / 自然", "health / 健康", "play / 遊ぶ"]],
  ["O-67", "学校で環境問題について学ぶことは大切だと思いますか？", "Do you think learning about environmental problems at school is important?", ["environment / 環境", "problem / 問題", "earth / 地球", "school / 学校", "learn / 学ぶ", "protect / 守る"]],
  ["O-68", "毎日同じ服を着る制服は便利だと思いますか？", "Do you think wearing the same school uniform every day is convenient?", ["uniform / 制服", "convenient / 便利な", "clothes / 服", "morning / 朝", "choice / 選択", "student / 生徒"]],
  ["O-69", "オンラインで友だちを作ることは良いと思いますか？", "Do you think making friends online is a good idea?", ["online / オンライン", "friend / 友だち", "safe / 安全な", "communication / 交流", "interest / 興味", "careful / 注意深い"]],
  ["O-70", "学校でスポーツ大会をすることは大切だと思いますか？", "Do you think sports events at school are important?", ["sports event / スポーツ大会", "school / 学校", "teamwork / 協力", "exercise / 運動", "memory / 思い出", "classmate / 同級生"]],
  ["O-71", "自分の部屋を持つことは大切だと思いますか？", "Do you think having your own room is important?", ["own room / 自分の部屋", "privacy / 個人の時間", "study / 勉強", "relax / 休む", "family / 家族", "space / 空間"]],
  ["O-72", "料理番組を見ることは役に立つと思いますか？", "Do you think watching cooking shows is useful?", ["cooking show / 料理番組", "recipe / レシピ", "food / 食べ物", "learn / 学ぶ", "useful / 役に立つ", "family / 家族"]],
  ["O-73", "学校で席替えを定期的にするべきだと思いますか？", "Do you think students should change seats regularly at school?", ["seat / 席", "classroom / 教室", "friend / 友だち", "regularly / 定期的に", "communication / 交流", "class / クラス"]],
  ["O-74", "旅行の計画を自分で立てることは大切だと思いますか？", "Do you think planning a trip by yourself is important?", ["trip / 旅行", "plan / 計画", "schedule / 予定", "money / お金", "experience / 経験", "independent / 自立した"]],
  ["O-75", "学校で健康についてもっと学ぶべきだと思いますか？", "Do you think students should learn more about health at school?", ["health / 健康", "school / 学校", "food / 食べ物", "exercise / 運動", "sleep / 睡眠", "knowledge / 知識"]],
  ["O-76", "テレビを見る時間を減らすべきだと思いますか？", "Do you think people should watch less TV?", ["TV / テレビ", "time / 時間", "habit / 習慣", "family / 家族", "study / 勉強", "relax / 休む"]],
  ["O-77", "学校でロボットを使うことは良いと思いますか？", "Do you think using robots at school is a good idea?", ["robot / ロボット", "school / 学校", "technology / 技術", "teacher / 先生", "learn / 学ぶ", "future / 将来"]],
  ["O-78", "子どもは家の手伝いをするべきだと思いますか？", "Do you think children should help with housework?", ["housework / 家事", "children / 子ども", "family / 家族", "responsibility / 責任", "help / 手伝う", "home / 家"]],
  ["O-79", "学校で昼寝の時間を作るべきだと思いますか？", "Do you think schools should have nap time?", ["nap / 昼寝", "school / 学校", "tired / 疲れた", "health / 健康", "concentrate / 集中する", "rest / 休憩"]],
  ["O-80", "海を守るためにプラスチックを減らすべきだと思いますか？", "Do you think people should reduce plastic to protect the ocean?", ["plastic / プラスチック", "ocean / 海", "reduce / 減らす", "environment / 環境", "waste / ごみ", "protect / 守る"]],
  ["O-81", "学校で自分の意見を発表することは大切だと思いますか？", "Do you think expressing your opinion at school is important?", ["opinion / 意見", "express / 表現する", "school / 学校", "confidence / 自信", "class / 授業", "idea / 考え"]],
  ["O-82", "毎日歩くことは健康に良いと思いますか？", "Do you think walking every day is good for health?", ["walk / 歩く", "health / 健康", "exercise / 運動", "daily / 毎日の", "body / 体", "easy / 簡単な"]],
  ["O-83", "家族旅行は大切だと思いますか？", "Do you think family trips are important?", ["family trip / 家族旅行", "memory / 思い出", "family / 家族", "experience / 経験", "talk / 話す", "fun / 楽しい"]],
  ["O-84", "学校で地域の歴史を学ぶべきだと思いますか？", "Do you think students should learn local history at school?", ["local history / 地域の歴史", "school / 学校", "culture / 文化", "community / 地域", "learn / 学ぶ", "past / 過去"]],
  ["O-85", "毎日机を整理することは大切だと思いますか？", "Do you think keeping your desk tidy every day is important?", ["desk / 机", "tidy / 整理された", "habit / 習慣", "study / 勉強", "clean / きれいな", "daily / 毎日の"]],
  ["O-86", "学校でチーム活動を増やすべきだと思いますか？", "Do you think schools should have more team activities?", ["team activity / チーム活動", "teamwork / 協力", "classmate / 同級生", "school / 学校", "communication / 交流", "learn / 学ぶ"]],
  ["O-87", "友だちへの誕生日プレゼントは必要だと思いますか？", "Do you think birthday presents for friends are necessary?", ["birthday / 誕生日", "present / プレゼント", "friend / 友だち", "feeling / 気持ち", "money / お金", "relationship / 関係"]],
  ["O-88", "学校で映画を使って学ぶことは良いと思いますか？", "Do you think using movies for learning at school is a good idea?", ["movie / 映画", "learning / 学習", "school / 学校", "fun / 楽しい", "understand / 理解する", "class / 授業"]],
  ["O-89", "自分で目標を決めることは大切だと思いますか？", "Do you think setting your own goals is important?", ["goal / 目標", "effort / 努力", "future / 将来", "motivation / やる気", "plan / 計画", "success / 成功"]],
  ["O-90", "学校で防災について学ぶべきだと思いますか？", "Do you think students should learn about disaster prevention at school?", ["disaster prevention / 防災", "school / 学校", "safety / 安全", "earthquake / 地震", "knowledge / 知識", "prepare / 準備する"]],
  ["O-91", "図書館は日曜日も開いているべきだと思いますか？", "Do you think libraries should be open on Sundays?", ["library / 図書館", "Sunday / 日曜日", "study / 勉強", "book / 本", "convenient / 便利な", "community / 地域"]],
  ["O-92", "学校で動物について学ぶことは大切だと思いますか？", "Do you think learning about animals at school is important?", ["animal / 動物", "school / 学校", "nature / 自然", "life / 命", "protect / 守る", "learn / 学ぶ"]],
  ["O-93", "一日を計画してから始めることは良いと思いますか？", "Do you think planning your day before it starts is a good idea?", ["plan / 計画", "day / 一日", "schedule / 予定", "time / 時間", "habit / 習慣", "productive / 生産的な"]],
  ["O-94", "学校で手話を学ぶべきだと思いますか？", "Do you think students should learn sign language at school?", ["sign language / 手話", "communication / 会話", "school / 学校", "understand / 理解する", "kindness / 優しさ", "society / 社会"]],
  ["O-95", "外国人観光客が増えることは良いと思いますか？", "Do you think having more foreign tourists is good?", ["tourist / 観光客", "foreign / 外国の", "culture / 文化", "economy / 経済", "communication / 交流", "city / 町"]],
  ["O-96", "学校で作文を書く練習を増やすべきだと思いますか？", "Do you think students should practice writing more at school?", ["writing / 作文", "practice / 練習", "school / 学校", "idea / 考え", "skill / 技能", "express / 表現する"]],
  ["O-97", "エアコンはすべての教室に必要だと思いますか？", "Do you think every classroom needs an air conditioner?", ["air conditioner / エアコン", "classroom / 教室", "summer / 夏", "comfortable / 快適な", "study / 勉強", "health / 健康"]],
  ["O-98", "好きなことを仕事にするべきだと思いますか？", "Do you think people should choose jobs they like?", ["job / 仕事", "like / 好き", "future / 将来", "money / お金", "happiness / 幸せ", "choice / 選択"]],
  ["O-99", "学校でコンテストに参加することは良い経験だと思いますか？", "Do you think joining contests at school is a good experience?", ["contest / コンテスト", "experience / 経験", "challenge / 挑戦", "school / 学校", "confidence / 自信", "effort / 努力"]],
  ["O-100", "将来、AIと一緒に勉強することは普通になると思いますか？", "Do you think studying with AI will become common in the future?", ["AI / AI", "future / 未来", "study / 勉強", "technology / 技術", "common / 普通の", "help / 助ける"]]
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

function defaultPhrases(keywords) {
  return {
    "意見を述べる表現": ["I think ～.", "In my opinion, ～.", "I believe that ～.", "Personally, I think ～."],
    "理由を述べる表現": ["because ～", "for example, ～", "This is because ～", "one reason is that ～"],
    "関連語句の例": keywords
  };
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
  <title>O-1〜O-100 英作文 毎日プリント</title>
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
  const basePrints = JSON.parse(fs.readFileSync(baseDataPath, "utf8")).prints;
  const commonData = JSON.parse(fs.readFileSync(commonPath, "utf8")).common;
  const template = fs.readFileSync(templatePath, "utf8");
  const generatedPrints = additionalTopics.map(([code, topic_jp, topic_en, keywords]) => ({
    code,
    topic_jp,
    topic_en,
    phrases: defaultPhrases(keywords)
  }));
  const allPrints = [...basePrints, ...generatedPrints];

  if (allPrints.length !== 100) {
    throw new Error(`Expected 100 prints, got ${allPrints.length}.`);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  const pages = allPrints.map((rawPrint) => extractMain(render(template, makeOpinionPrint(rawPrint), commonData)));
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
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      timeout: 120000
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
