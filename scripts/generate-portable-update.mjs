import crypto from "node:crypto";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(await fsPromises.readFile(path.join(root, "package.json"), "utf8"));
const outputDirectory = path.resolve(process.env.CAMPAIGN_ENGINE_DIST_DIR || process.argv[2] || path.join(root, "dist"));
const file = `${packageJson.productName} Portable ${packageJson.version}.exe`;
const executablePath = path.join(outputDirectory, file);
const stat = await fsPromises.stat(executablePath);
const hash = crypto.createHash("sha512");

await new Promise((resolve, reject) => {
  const stream = fs.createReadStream(executablePath);
  stream.on("data", chunk => hash.update(chunk));
  stream.on("error", reject);
  stream.on("end", resolve);
});

const manifest = {
  schemaVersion: 1,
  version: packageJson.version,
  file,
  sha512: hash.digest("base64"),
  size: stat.size
};
const destination = path.join(outputDirectory, "latest-portable.json");
await fsPromises.writeFile(destination, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Created portable update metadata: ${destination}`);
