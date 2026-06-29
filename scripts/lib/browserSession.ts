import { Browserbase } from "@browserbasehq/sdk";
import { chromium, type Browser, type Page } from "playwright";

export interface AutomationBrowserSession {
  browser: Browser;
  page: Page;
  sessionId?: string;
  sessionUrl?: string;
}

export async function createAutomationBrowserSession(): Promise<AutomationBrowserSession> {
  const apiKey = process.env.BROWSERBASE_API_KEY;

  if (apiKey) {
    const browserbase = new Browserbase({ apiKey, timeout: 120_000 });
    const session = await browserbase.sessions.create({
      browserSettings: {
        viewport: {
          width: 1280,
          height: 720,
        },
      },
    });
    const browser = await chromium.connectOverCDP(session.connectUrl);
    const context = browser.contexts()[0] || (await browser.newContext());
    const page = context.pages()[0] || (await context.newPage());

    return {
      browser,
      page,
      sessionId: session.id,
      sessionUrl: `https://www.browserbase.com/sessions/${session.id}`,
    };
  }

  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
  });
  const page = await browser.newPage({
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
    viewport: { width: 1280, height: 720 },
    extraHTTPHeaders: {
      "Accept-Language": "en-IN,en;q=0.9",
    },
  });

  return { browser, page };
}
