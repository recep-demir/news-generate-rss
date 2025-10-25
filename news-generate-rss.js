import puppeteer from "puppeteer";
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
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
  );
  await page.setExtraHTTPHeaders({ "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8" });
  await page.setViewport({ width: 1366, height: 900 });

  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForTimeout(3000);
  await autoScroll(page);
  await page.waitForSelector(".content-card, .cards .card, article a", { timeout: 20000 });

  const html = await page.content();
  const $ = cheerio.load(html);
  const items = [];

  const cards = $(".content-card, a.content-card, .cards .card, article a");
  cards.each((i, el) => {
    const el$ = $(el);
    const title =
      el$.find(".content-title").text().trim() ||
      el$.attr("title")?.trim() ||
      el$.text().trim();

    const href =
      el$.attr("href") ||
      el$.find("a").attr("href") ||
      el$.closest("a").attr("href");

    const desc =
      el$.find(".content-summary").text().trim() ||
      el$.find(".summary").text().trim() ||
      "";

    if (title && href && href.startsWith("/")) {
      items.push({
        title,
        link: "https://eksiseyler.com" + href,
        desc,
        date: new Date(),
        category: name,
      });
    }
  });

  console.log(`✅ ${name}: ${items.length} içerik bulundu`);
  return items;
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let total = 0;
      const distance = 600;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        total += distance;
        if (total > document.body.scrollHeight * 0.9) {
          clearInterval(timer);
          resolve();
        }
      }, 250);
    });
  });
}

async function generateRSS() {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox","--disable-setuid-sandbox"] });
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
      let items = await fetchCategory(cat, page);
      if (items.length === 0) {
        await page.waitForTimeout(3000);
        items = await fetchCategory(cat, page);
      }
      allItems = allItems.concat(items);
    } catch (e) {
      console.error(`⚠️ ${cat.name} kategorisi hata:`, e.message);
    }
  }

  if (allItems.length === 0) {
    feed.item({
      title: "[Bilgi] İçerik alınamadı",
      description: "Beklenmedik durum nedeniyle içerik çekilemedi. Bir sonraki çalıştırmada denenecek.",
      url: "https://eksiseyler.com/",
      date: new Date(),
    });
  } else {
    allItems.forEach((item) =>
      feed.item({
        title: `[${item.category}] ${item.title}`,
        description: item.desc,
        url: item.link,
        date: item.date,
      })
    );
  }

  fs.writeFileSync("seyler.xml", feed.xml({ indent: true }));
  console.log("📝 RSS yazıldı: seyler.xml");

  await browser.close();
}

generateRSS().catch(console.error);