import fs from "node:fs";
import path from "node:path";

const version = String(process.argv[2] || "").trim();
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error("Use a semantic version such as 1.0.1 or 1.1.0-beta.1.");
}

const packagePath = path.resolve(import.meta.dirname, "..", "package.json");
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
packageJson.version = version;
fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
console.log(`Campaign Engine version is now ${version}.`);
