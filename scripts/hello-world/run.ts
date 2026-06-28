import fs from "fs";
import path from "path";

const outputDir = process.env.SCRIPT_OUTPUT_DIR || ".";

console.log("Hello from your automation script!");
console.log(`Writing output to: ${outputDir}`);

const resultPath = path.join(outputDir, "result.txt");
fs.writeFileSync(
  resultPath,
  `Script completed successfully at ${new Date().toISOString()}\n`
);

console.log(`Created artifact: ${resultPath}`);
