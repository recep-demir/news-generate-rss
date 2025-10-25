import playwright from "playwright-extra";
import StealthPlugin from "playwright-extra-plugin-stealth";
playwright.use(StealthPlugin());

const { chromium } = playwright;
import { chromium } from "playwright";
import * as cheerio from "cheerio";
import RSS from "rss";
import fs from "fs";

const categories = [
  { name: "Kültür",  url: "https://eksiseyler.com/kategori/kultur" },
  { name: "Bilim",   url: "https://eksiseyler.com/kategori/bilim" },
  { name: "Spor",    url: "https://eksiseyler.com/kategori/spor" },
  { name: "Haber",   url: "https://eksiseyler.com/kategori/haber" },
  { name: "Yaşam",   url: "https://eksiseyler.com/kategori/yasam" },
  { name: "Eğlence", url: "https://eksiseyler.com/kategori/eglence" }
];

async function fetchCategory({ name, url }, page) {
  console.log(`🔎 ${name} kategorisi çekiliyor...`);
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);

  const html = await page.content();
  const $ = cheerio.load(html);
  const items = [];

  $(".content-card").each((i, el) => {
    const title = $(el).find(".content-title").text().trim();
    const link = "https://eksiseyler.com" + $(el).find("a").attr("href");
    const desc = $(el).find(".content-summary").text().trim();
    if (title && link) {
      items.push({ title, link, desc, date: new Date(), category: name });
    }
  });

  console.log(`✅ ${name}: ${items.length} içerik bulundu`);
  return items;
}

async function generateRSS() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const feed = new RSS({
    title: "Ekşi Şeyler - 6 Kategori",
    description: "Ekşi Şeyler'deki son içerikler (Kültür, Bilim, Spor, Haber, Yaşam, Eğlence)",
    feed_url: "https://recep-demir.github.io/news-generate-rss/seyler.xml",
    site_url: "https://eksiseyler.com/",
    language: "tr",
  });

  let allItems = [];
  for (const cat of categories) {
    try {
      const items = await fetchCategory(cat, page);
      allItems = allItems.concat(items);
    } catch (err) {
      console.error(`⚠️ ${cat.name} hata:`, err.message);
    }
  }

  if (allItems.length === 0) {
    feed.item({
      title: "[Bilgi] İçerik alınamadı",
      description: "Ekşi Şeyler içeriği alınamadı. Bir sonraki çalıştırmada yeniden denenecek.",
      url: "https://eksiseyler.com/",
      date: new Date(),
    });
  } else {
    allItems.forEach((item) => {
      feed.item({
        title: `[${item.category}] ${item.title}`,
        description: item.desc,
        url: item.link,
        date: item.date,
      });
    });
  }

  fs.writeFileSync("seyler.xml", feed.xml({ indent: true }));
  console.log("📝 RSS yazıldı: seyler.xml");

  await browser.close();
}

generateRSS().catch(console.error);