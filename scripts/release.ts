import { execSync, spawnSync } from "child_process";
import {
  mkdirSync,
  readdirSync,
  copyFileSync,
  existsSync,
  readFileSync,
} from "fs";
import { join, basename } from "path";

const root = join(import.meta.dir, "..");
const bundleDir = join(root, "src-tauri", "target", "release", "bundle");
const outDir = join(root, "release");

const { version } = JSON.parse(
  readFileSync(join(root, "src-tauri", "tauri.conf.json"), "utf8"),
);

function toWslPath(winPath: string): string {
  return winPath
    .replace(/\\/g, "/")
    .replace(/^([A-Za-z]):/, (_, d) => `/mnt/${d.toLowerCase()}`);
}

function collectWindowsArtifacts(): string[] {
  const nsisDir = join(bundleDir, "nsis");
  if (!existsSync(nsisDir)) return [];
  return readdirSync(nsisDir)
    .filter((f) => f.endsWith(".exe") && f.includes(version))
    .map((f) => join(nsisDir, f));
}

console.log("=== Building Windows (NSIS) ===");
execSync("bunx tauri build --bundles nsis", { stdio: "inherit", cwd: root });

console.log(`\n=== Collecting artifacts (v${version}) ===`);
mkdirSync(outDir, { recursive: true });

console.log("\n=== Building Linux via WSL2 (deb, AppImage, rpm) ===");
const wslRoot = toWslPath(root);
const wslOut = toWslPath(outDir);
// Pin CARGO_TARGET_DIR to a WSL-native path so we always know where artifacts land.
// Without this, if the user has CARGO_TARGET_DIR set in their WSL env, the Windows-side
// glob (and even find-from-project-dir) would miss the artifacts entirely.
const wslTargetDir = "$HOME/.powertoys-target";
const wslCmd = [
  `export PATH="$HOME/.cargo/bin:$HOME/.bun/bin:$PATH"`,
  `export CARGO_TARGET_DIR=${wslTargetDir}`,
  `cd '${wslRoot}'`,
  `bun run tauri build --bundles deb,appimage,rpm`,
  `find ${wslTargetDir}/release/bundle \\( -name "*${version}*.deb" -o -name "*${version}*.AppImage" -o -name "*${version}*.rpm" \\) -exec cp {} '${wslOut}/' \\;`,
].join(" && ");
// Use spawnSync (no shell) so cmd.exe doesn't mangle the nested quotes in wslCmd.
const wslResult = spawnSync("wsl", ["--", "bash", "-c", wslCmd], {
  stdio: "inherit",
});
if (wslResult.status !== 0) process.exit(wslResult.status ?? 1);

const winArtifacts = collectWindowsArtifacts();
if (winArtifacts.length === 0) {
  console.error("No Windows .exe found in", join(bundleDir, "nsis"));
  process.exit(1);
}

for (const src of winArtifacts) {
  const dest = join(outDir, basename(src));
  copyFileSync(src, dest);
  console.log(" ", basename(src));
}

console.log(`\nDone. Check release/ for all artifacts.`);
