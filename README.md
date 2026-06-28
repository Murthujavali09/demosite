<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/41173ad7-7ba4-428c-af04-c4809a2b2afd

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
How to add a new script
Create scripts/my-script/script.json:

{
  "name": "My Custom Script",
  "description": "What this script does",
  "category": "Automation",
  "icon": "terminal",
  "runner": "tsx",
  "entry": "run.ts"
}
Then add the entry file. For TypeScript scripts (runner: "tsx"):

import fs from "fs";
import path from "path";
const outputDir = process.env.SCRIPT_OUTPUT_DIR!;
fs.writeFileSync(path.join(outputDir, "output.txt"), "done");
For Playwright (runner: "playwright"), use a *.spec.ts file and write screenshots/files to process.env.SCRIPT_OUTPUT_DIR.

Icons: chrome, terminal, file, message, git, database, camera, code

How to run
npm install
npm run dev
This starts:

Frontend at http://localhost:3000
API at http://localhost:3001
Log in, go to the dashboard, and run Hello World Script first — it’s a quick sanity check. Then try Amazon AC Screenshot Scraper (Playwright; Amazon may block bots sometimes).

Notes
entry is optional if you use a standard name: run.spec.ts, run.ts, index.ts, etc.
runner is auto-detected: .spec.ts → Playwright, .ts → tsx
Script console.log output appears in the activity log panel
Save artifacts to SCRIPT_OUTPUT_DIR so the UI can offer download/preview