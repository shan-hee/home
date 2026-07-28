import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");

const sqlText = (value) => `'${String(value).replaceAll("'", "''")}'`;
const now = new Date().toISOString();
const seedRevision = Math.floor(Date.now() / 1000);
const localSeedPath = resolve(projectRoot, ".site-content.seed.json");
const seedPath = existsSync(localSeedPath)
  ? localSeedPath
  : resolve(projectRoot, "scripts/site-content.seed.example.json");
const sections = JSON.parse(readFileSync(seedPath, "utf8"));
const requiredSections = ["profile", "siteLinks", "socialLinks", "music", "wallpaper", "preferences", "hitokoto"];
if (
  !sections || typeof sections !== "object" || Array.isArray(sections)
  || requiredSections.some((key) => !(key in sections))
) {
  throw new Error("Seed 文件必须包含 profile、siteLinks、socialLinks、music、wallpaper、preferences 和 hitokoto");
}

const statements = [
  ...Object.entries(sections).map(([key, content]) => (
    `INSERT OR IGNORE INTO content_sections (`
      + "section_key, content_json, revision, updated_at, updated_by_device"
      + `) VALUES (${sqlText(key)}, ${sqlText(JSON.stringify(content))}, ${seedRevision}, ${sqlText(now)}, NULL);`
  )),
];

const outputDirectory = resolve(projectRoot, ".tmp");
mkdirSync(outputDirectory, { recursive: true });
const outputPath = resolve(outputDirectory, "local-seed.sql");
writeFileSync(outputPath, `${statements.join("\n")}\n`, "utf8");
console.log(`已生成 ${outputPath}`);
