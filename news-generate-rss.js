import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import RSS from "rss";
import fs from "fs";

const categories = [
  { name: "Kültür", url: "https://eksiseyler.com/kategori/kultur" },
  { name: "Bilim", url: "https://eksiseyler.com/kategori/bilim" },
  { name: "Spor", url: "https://eksiseyler.com/kategori/spor" },
];

async function fetchCategory({ name, url }, page) {
  console.log(`🔎 ${name} kategorisi çekiliyor...`);
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const html = await page.content();
  const $ = cheerio.load(html);
  const items = [];

  $(".content-card").each((i, el) => {
    const title = $(el).find(".content-title").text().trim();
    const link = "https://eksiseyler.com" + $(el).find("a").attr("href");
    const desc = $(el).find(".content-summary").text().trim();
    const date = new Date();

    items.push({ title, link, desc, date, category: name });
  });

  return items;
}

async function generateRSS() {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  const feed = new RSS({
    title: "Ekşi Şeyler - Kültür, Bilim, Spor",
    description: "Ekşi Şeyler'deki son içerikler (Kültür, Bilim, Spor)",
    feed_url: "https://eksiseyler.com/",
    site_url: "https://eksiseyler.com/",
    language: "tr",
  });

  let allItems = [];
  for (const cat of categories) {
    try {
      const items = await fetchCategory(cat, page);
      allItems = allItems.concat(items);
    } catch (err) {
      console.error(`⚠️ ${cat.name} kategorisinde hata:`, err.message);
    }
  }

  allItems.forEach((item) => {
    feed.item({
      title: `[${item.category}] ${item.title}`,
      description: item.desc,
      url: item.link,
      date: item.date,
    });
  });

  fs.writeFileSync("seyler.xml", feed.xml({ indent: true }));
  console.log("✅ RSS feed oluşturuldu: seyler.xml");

  await browser.close();
}

generateRSS().catch(console.error);