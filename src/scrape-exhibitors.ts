import { chromium } from "playwright";
import fs from "fs";

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(
    "https://exhibitors.expandnorthstar.com/expand-north-star-2024/Exhibitor",
    { waitUntil: "domcontentloaded" }
  );

  const companies: any[] = [];
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  for (const letter of letters) {
    console.log(`🔤 Processing letter: ${letter}`);

    const button = await page.$(`#alphabet_${letter}`);
    if (!button) {
      console.log(`⚠️ Letter ${letter} not found.`);
      continue;
    }

    await button.click();
    await page.waitForTimeout(1000);

    // Scroll to bottom until card count stops changing
    let prevCount = 0;
    while (true) {
      const cards = await page.$$(".list-group-item");
      const currentCount = cards.length;
      if (currentCount === prevCount) break;
      prevCount = currentCount;
      await page.mouse.wheel(0, 5000); // simulate real scroll
      await page.waitForTimeout(1500);
    }

    // Wait a moment for DOM to stabilize
    await page.waitForTimeout(2000);

    // Extract fresh list of all profile URLs AFTER scrolling finishes
    const profileUrls = await page.$$eval(".list-group-item a", (links) =>
      links
        .map((link) => (link as HTMLAnchorElement).href)
        .filter((href) => href.includes("/Exhibitor/"))
    );

    console.log(
      `🔍 Found ${profileUrls.length} companies under letter ${letter}`
    );

    for (const url of profileUrls) {
      try {
        const detailPage = await browser.newPage();
        await detailPage.goto(url, { waitUntil: "domcontentloaded" });

        const name = await detailPage.locator("h4.card-title").textContent();
        const standInfo = await detailPage
          .locator('p:has-text("Stand No")')
          .textContent();
        const country = await detailPage
          .locator(".head_discription p:nth-of-type(2) span")
          .first()
          .textContent();
        const description = await detailPage
          .locator('h5:has-text("Company Profile") + p')
          .textContent();

        const sectors = await detailPage.$$eval("ul.sector_block > li", (els) =>
          els.map((el) => el.textContent?.trim()).filter(Boolean)
        );

        const websiteURL = await detailPage
          .locator(".social_website a")
          .first()
          .getAttribute("href");

        const socialLinks = await detailPage.$$eval(
          ".social_media_block li a",
          (anchors) =>
            anchors.map((a) => a.getAttribute("href")).filter(Boolean)
        );

        companies.push({
          name: name?.trim(),
          standInfo: standInfo?.trim(),
          country: country?.trim(),
          description: description?.trim(),
          sectors,
          websiteURL,
          socialLinks,
        });

        await detailPage.close();
      } catch (err) {
        console.error(`❌ Failed parsing ${url}`, err);
      }
    }
  }

  fs.writeFileSync("companies.json", JSON.stringify(companies, null, 2));
  console.log("✅ All data saved to companies.json");
  await browser.close();
})();
