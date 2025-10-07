import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    const [, , inputPath, mimeTypeArg] = process.argv;
    if (!inputPath) {
        console.error("Usage: node scripts/debug-parse.mjs <file> [mimeType]");
        process.exit(1);
    }

    const resolvedPath = path.resolve(inputPath);
    const mimeType = mimeTypeArg || "application/pdf";

    const { parseResume } = await import("../src/lib/resume-parser.js");

    const buffer = await fs.promises.readFile(resolvedPath);
    const result = await parseResume(buffer, mimeType);
    console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
