import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { basename, dirname, extname, join, relative } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const bundleRoot = join(root, "src-tauri", "target", "release", "bundle");
const outputRoot = join(root, "dist", "artifacts");

const bundleExtensions = new Set([
  ".app",
  ".zip",
  ".dmg",
  ".msi",
  ".exe",
  ".deb",
  ".rpm",
  ".AppImage",
]);

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function walk(path, entries = []) {
  if (!existsSync(path)) {
    return entries;
  }

  for (const entry of readdirSync(path)) {
    const fullPath = join(path, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      if (fullPath.endsWith(".app")) {
        entries.push(fullPath);
        continue;
      }

      walk(fullPath, entries);
      continue;
    }

    entries.push(fullPath);
  }

  return entries;
}

function isBundleFile(path) {
  const name = basename(path);
  if (name.startsWith("rw.")) {
    return false;
  }

  const extension = extname(path);
  return bundleExtensions.has(extension) || path.endsWith(".app");
}

function zipMacApp(appPath, zipPath) {
  execFileSync("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", appPath, zipPath], {
    stdio: "inherit",
  });
}

rmSync(outputRoot, { recursive: true, force: true });
ensureDir(outputRoot);

const copied = [];

for (const filePath of walk(bundleRoot)) {
  if (!isBundleFile(filePath)) {
    continue;
  }

   if (process.platform === "darwin" && filePath.endsWith(".zip")) {
    const appName = filePath.slice(0, -4);
    if (existsSync(appName)) {
      continue;
    }
  }

  const relDir = relative(bundleRoot, dirname(filePath));
  const targetDir = join(outputRoot, relDir);
  ensureDir(targetDir);

  const targetPath = join(targetDir, basename(filePath));
  cpSync(filePath, targetPath, { recursive: true });
  copied.push(relative(root, targetPath));

  if (process.platform === "darwin" && filePath.endsWith(".app")) {
    const zipPath = join(targetDir, `${basename(filePath)}.zip`);
    zipMacApp(filePath, zipPath);
    copied.push(relative(root, zipPath));
  }
}

if (copied.length === 0) {
  console.warn("No bundle artifacts were found.");
} else {
  console.log("Collected artifacts:");
  for (const file of copied) {
    console.log(`- ${file}`);
  }
}
