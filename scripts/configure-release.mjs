import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const updateUrl = String(process.env.CAMPAIGN_ENGINE_UPDATE_URL || process.argv[2] || "").trim().replace(/\/+$/, "");

if (!/^https:\/\/[^/]+/i.test(updateUrl)) {
  throw new Error("Set CAMPAIGN_ENGINE_UPDATE_URL to the HTTPS folder that will contain the Windows executables and update metadata.");
}

const destination = path.join(root, "release-config.generated.json");
fs.writeFileSync(destination, `${JSON.stringify({ updateUrl }, null, 2)}\n`, "utf8");
console.log(`Configured desktop updates from ${updateUrl}`);
