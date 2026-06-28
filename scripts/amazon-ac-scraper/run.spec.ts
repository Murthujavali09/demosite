import { test } from "@playwright/test";
import path from "path";

test("capture amazon ac product page", async ({ page }) => {
  const outputDir = process.env.SCRIPT_OUTPUT_DIR || ".";

  await page.goto("https://www.amazon.in/s?k=split+air+conditioner", {
    waitUntil: "domcontentloaded",
  });

  const productLink = page.locator('[data-component-type="s-search-result"] h2 a').first();
  await productLink.waitFor({ state: "visible", timeout: 30_000 });
  await productLink.click();

  await page.waitForSelector("#productTitle", { timeout: 30_000 });

  await page.screenshot({
    path: path.join(outputDir, "amazon-product.png"),
    fullPage: true,
  });
});
