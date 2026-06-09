const fs = require('fs');
const path = require('path');
const https = require('https');

const outputDir = 'old-posts';

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir);

const articles = [
  { date: "03-06-2025", slug: "tsmcinus", title: "台積電、美國、中國" },
  { date: "03-02-2025", slug: "europeonitsown", title: "美國獨善其身，歐洲自立自強？" },
  { date: "02-22-2025", slug: "collectiveeurope", title: "死氣沉沉的歐洲" },
  { date: "02-11-2025", slug: "tesladoge", title: "特斯拉DOGE" },
  { date: "02-02-2025", slug: "returnofusa", title: "美國重返榮耀" },
  { date: "01-30-2025", slug: "sapiens", title: "智人的道德觀" },
  { date: "01-24-2025", slug: "chinaai", title: "中國AI" },
  { date: "01-14-2025", slug: "solidarity", title: "團結分立" },
  { date: "01-05-2025", slug: "internationalism", title: "左派國際主義的荒謬" },
  { date: "12-31-2024", slug: "dontbechinese", title: "此生不做中國人" },
  { date: "12-25-2024", slug: "chinashock", title: "中國衝擊" },
  { date: "12-09-2024", slug: "amywax", title: "亞裔少一點？" },
  { date: "12-01-2024", slug: "dei", title: "進步價值滿滿" },
  { date: "11-26-2024", slug: "returnofmuscle", title: "肌肉男的逆襲" },
  { date: "11-17-2024", slug: "fightthelastwar", title: "聯俄制中" },
  { date: "11-11-2024", slug: "teslatentrillion", title: "十兆特斯拉" },
  { date: "11-09-2024", slug: "liberalbutts", title: "別人的屁股" },
  { date: "11-06-2024", slug: "commonsense", title: "正常道理" },
  { date: "10-30-2024", slug: "negotiatedpeace", title: "烏克蘭的和平" },
  { date: "10-25-2024", slug: "obamahypocricy", title: "歐巴馬的反省" },
  { date: "10-19-2024", slug: "trumponxi", title: "川普的對中策略" },
  { date: "10-18-2024", slug: "safedemocracy", title: "民主不該是成王敗寇" },
  { date: "10-11-2024", slug: "robotaxi", title: "特斯拉新品" },
  { date: "10-04-2024", slug: "longshoremen", title: "碼頭工人" },
  { date: "09-29-2024", slug: "housingpolicy", title: "容積率和打房" },
  { date: "09-20-2024", slug: "kamala", title: "賀錦麗" },
  { date: "09-14-2024", slug: "immigration", title: "吃貓吃狗" },
  { date: "09-08-2024", slug: "oliviali", title: "Olivia Li" },
  { date: "09-01-2024", slug: "freepress", title: "言論自由" },
  { date: "08-27-2024", slug: "freewill", title: "自由意志" },
  { date: "08-22-2024", slug: "paradise", title: "天堂之道" },
  { date: "08-18-2024", slug: "goldenstate", title: "黃金之州" },
  { date: "08-07-2024", slug: "ubi", title: "Universal Basic Income" },
  { date: "08-03-2024", slug: "nike", title: "Nike" },
  { date: "07-28-2024", slug: "hessler", title: "何偉" },
  { date: "07-21-2024", slug: "bidenisout", title: "吹倒拜登的風" },
  { date: "07-16-2024", slug: "jdvance", title: "J.D. Vance" },
  { date: "07-11-2024", slug: "hegelonchina", title: "黑格爾看中國" },
  { date: "06-30-2024", slug: "fermiparadox", title: "費米悖論" },
  { date: "06-26-2024", slug: "yenyasu", title: "日圓跌不停" },
  { date: "06-19-2024", slug: "deepwellai", title: "深井AI" },
  { date: "06-11-2024", slug: "singapore", title: "新加坡" },
  { date: "06-03-2024", slug: "sloar", title: "免費電力未來" },
  { date: "05-31-2024", slug: "guiltytrump", title: "法律之前人人平等" },
  { date: "05-30-2024", slug: "gloriousrevolution", title: "光榮革命" },
  { date: "05-26-2024", slug: "contemptofcongress", title: "藐視國會" },
  { date: "05-18-2024", slug: "fightdirty", title: "堅壁清野" },
  { date: "05-14-2024", slug: "teslastrategy", title: "特斯拉的三個面向" },
  { date: "05-09-2024", slug: "lastingorganizations", title: "沒有不敗的組織" },
  { date: "05-04-2024", slug: "zeigeist", title: "捍衛生活方式" },
  { date: "04-30-2024", slug: "nationalstrategy", title: "國家策略" },
  { date: "04-25-2024", slug: "jewishcivilwar", title: "猶太勢力" },
  { date: "04-21-2024", slug: "privateequity", title: "私募" },
  { date: "04-14-2024", slug: "classnevertaken", title: "沒上的課" },
  { date: "04-09-2024", slug: "responsibility", title: "政客負責任" },
  { date: "03-27-2024", slug: "moredemocracy", title: "更多的民主" },
  { date: "03-22-2024", slug: "calvanistholland", title: "喀爾文的荷蘭" },
  { date: "03-19-2024", slug: "tpesfo", title: "台北舊金山雙城記" },
  { date: "03-16-2024", slug: "sourceoffreedom", title: "自由的基礎" },
  { date: "03-13-2024", slug: "democracywins", title: "民主必勝？" },
  { date: "01-11-2024", slug: "risingtaiwan", title: "上升的台灣" },
  { date: "01-07-2024", slug: "tppsfuture", title: "民眾黨的未來" },
  { date: "01-04-2024", slug: "kmtsfuture", title: "國民黨的未來" },
  { date: "12-26-2023", slug: "taiwanaoc", title: "民意代表的魅力之道" },
  { date: "12-21-2023", slug: "spywar", title: "間諜大戰" },
  { date: "12-17-2023", slug: "winterwar", title: "冬季戰爭" },
  { date: "12-10-2023", slug: "rootless", title: "失根的野草" },
  { date: "12-02-2023", slug: "anduril", title: "不動的疆界，浮動的人心" },
  { date: "11-24-2023", slug: "kpisdead", title: "柯文哲完蛋" },
  { date: "11-04-2023", slug: "oneparty", title: "民進黨一黨獨大的必要性" },
  { date: "10-28-2023", slug: "lekeqian", title: "李克強死亡是共產黨大清洗的開始" },
  { date: "10-19-2023", slug: "diligentxijinping", title: "勤政的亡國君" },
  { date: "10-12-2023", slug: "junglegrowsback", title: "叢草蔓生" },
  { date: "10-07-2023", slug: "douyin", title: "封殺抖音" },
  { date: "10-03-2023", slug: "partypolitics", title: "尚黑為黨" },
  { date: "09-26-2023", slug: "huaweismic", title: "華為的挑戰" },
  { date: "09-20-2023", slug: "eggfight", title: "親痛仇快" },
  { date: "09-15-2023", slug: "chinabasketball", title: "中國沒有灌籃高手" },
  { date: "09-02-2023", slug: "greenpowerfuture", title: "綠電未來" },
  { date: "08-28-2023", slug: "japan1941", title: "日本1941" },
  { date: "06-04-2023", slug: "nowar", title: "中國不會打台灣" },
  { date: "05-30-2023", slug: "nissei", title: "Boy, you are free" },
  { date: "05-15-2023", slug: "avedisianC", title: "Edward Avedisian" },
  { date: "04-06-2023", slug: "daprice", title: "混蛋檢察官Pamela Price" },
  { date: "04-05-2023", slug: "clark", title: "Caitlin Clark的籃球" },
  { date: "05-29-2022", slug: "chinesedemocracy", title: "中國的民主之路" },
  { date: "12-04-2019", slug: "parliamentarysystem", title: "內閣制與不分區立委" },
  { date: "05-14-2019", slug: "robertcaro", title: "Robert Caro" },
  { date: "01-11-2019", slug: "samrayburn", title: "Sam Rayburn" },
  { date: "10-05-2017", slug: "bobnoyce", title: "Bob Noyce" },
];

console.log(`Converting ${articles.length} posts from jaychen.info...\n`);

articles.forEach((article) => {
  const filename = `${article.date}.md`;
  const filepath = path.join(outputDir, filename);

  const markdown = `---
title: "${article.title}"
date: "${article.date}"
---

*Imported from old site: https://www.jaychen.info*
`;

  fs.writeFileSync(filepath, markdown);
  console.log(`✅ ${filename}`);
});

console.log(`\n🎉 Done! All posts saved in the "old-posts" folder.`);
