import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

export const getDependencyTree = (repoUrl) => {
  let tempDir = null;

  try {
    console.log("📦 Preparing repo for dependency tree...");

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "repo-"));

    console.log("📁 Temp dir:", tempDir);

    /* =========================
       ⬇️ CLONE REPO
    ========================= */
    execSync(`git clone ${repoUrl} ${tempDir}`, {
      stdio: "ignore"
    });

    console.log("⬇️ Repo cloned");

    /* =========================
       🔥 TRY INSTALL (SAFE MODE)
    ========================= */
    try {
      execSync("npm install --legacy-peer-deps --no-audit --no-fund", {
        cwd: tempDir,
        stdio: "ignore"
      });
      console.log("📦 npm install success");
    } catch (err) {
      console.log("⚠️ npm install failed, trying fallback...");
    }

    /* =========================
       🔥 FORCE TREE (IMPORTANT)
    ========================= */
    let output;

    try {
      output = execSync("npm ls --json --all", {
        cwd: tempDir,
        encoding: "utf-8"
      });
    } catch (err) {
      console.log("⚠️ npm ls error but continuing...");
      output = err.stdout; // ✅ EVEN ON ERROR TAKE OUTPUT
    }

    if (!output) return null;

    console.log("🌳 Dependency tree generated");

    return JSON.parse(output);

  } catch (err) {
    console.log("❌ Dependency tree fatal error:", err.message);
    return null;

  } finally {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log("🧹 Temp repo deleted");
    }
  }
};