import { cpSync, mkdirSync, existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

/** Prisma runtime bundles reference .map files that are not shipped; strip to quiet debuggers. */
function stripOrphanSourceMapComments(dir) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, ent.name);
    if (ent.isDirectory()) {
      stripOrphanSourceMapComments(path);
      continue;
    }
    if (!ent.name.endsWith(".js")) {
      continue;
    }
    const text = readFileSync(path, "utf8");
    const next = text.replace(/\/\/# sourceMappingURL=.*\r?\n?/g, "");
    if (next !== text) {
      writeFileSync(path, next);
    }
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

const sourceDir = join(rootDir, "src", "generated", "prisma");
const destDir = join(rootDir, "build", "generated", "prisma");

try {
  if (!existsSync(sourceDir)) {
    console.error(
      '✗ Prisma generated files not found. Please run "prisma generate" first.',
    );
    process.exit(1);
  }

  mkdirSync(join(rootDir, "build", "generated"), { recursive: true });

  cpSync(sourceDir, destDir, { recursive: true, force: true });
  stripOrphanSourceMapComments(destDir);
  console.log("✓ Copied Prisma generated files to build directory");
} catch (error) {
  console.error("✗ Failed to copy Prisma generated files:", error.message);
  process.exit(1);
}
