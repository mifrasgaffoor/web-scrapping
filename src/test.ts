import { chromium } from "playwright";
import fs from "fs";
// npx ts-node src/test.ts

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(
    "https://exhibitors.expandnorthstar.com/north-star-2023/Exhibitor",
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

    // Scroll until "No more content available" is visible
    const endLocator = page.locator("h5:has-text('No more content available')");
    while (true) {
      await page.mouse.wheel(0, 5000);
      await page.waitForTimeout(1000);
      if (await endLocator.isVisible()) break;
    }

    await page.waitForTimeout(1000); // Allow last items to render

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


