import { test, type Page } from "@playwright/test";
import path from "path";

async function dismissAmazonGate(page: Page) {
  const continueShopping = page.getByRole("button", { name: "Continue shopping" });
  if (await continueShopping.isVisible().catch(() => false)) {
    await continueShopping.click();
    await page.waitForLoadState("domcontentloaded");
  }
}

test("capture amazon ac product page", async ({ page }) => {
  const outputDir = process.env.SCRIPT_OUTPUT_DIR || ".";
  const screenshotPath = path.join(outputDir, "amazon-product.png");

  await page.goto("https://www.amazon.in/s?k=split+air+conditioner", {
    waitUntil: "domcontentloaded",
  });
  await dismissAmazonGate(page);

  const productLink = page
    .locator('a[href*="/dp/"]')
    .filter({ has: page.getByRole("heading", { level: 2 }) })
    .first();

  await productLink.waitFor({ state: "visible", timeout: 30_000 });

  const href = await productLink.getAttribute("href");
  if (!href) {
    throw new Error("Could not find a product link on the search results page");
  }

  const productUrl = href.startsWith("http") ? href : `https://www.amazon.in${href}`;
  await page.goto(productUrl, { waitUntil: "domcontentloaded" });
  await dismissAmazonGate(page);

  await page.locator("#productTitle, #title").first().waitFor({
    state: "visible",
    timeout: 30_000,
  });

  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
  });
});
