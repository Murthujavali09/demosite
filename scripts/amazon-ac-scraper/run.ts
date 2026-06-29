import path from "path";
import type { Page } from "playwright";
import { createAutomationBrowserSession } from "../lib/browserSession.js";

async function dismissAmazonGate(page: Page) {
  const continueShopping = page.getByRole("button", { name: "Continue shopping" });
  if (await continueShopping.isVisible().catch(() => false)) {
    await continueShopping.click();
    await page.waitForLoadState("domcontentloaded");
  }
}

async function main() {
  const outputDir = process.env.SCRIPT_OUTPUT_DIR || ".";
  const screenshotPath = path.join(outputDir, "amazon-product.png");
  const { browser, page, sessionUrl } = await createAutomationBrowserSession();

  if (sessionUrl) {
    console.log(`[browserbase] Session replay: ${sessionUrl}`);
  } else {
    console.log("[browser] Running with local Chrome");
  }

  try {
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

    console.log(`[artifact] Saved screenshot to ${screenshotPath}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
