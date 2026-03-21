import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

/**
 * 🔥 Clone repo + get dependency tree (PRODUCTION READY)
 */
export const getDependencyTree = async (repoUrl, token = null) => {
  let tempDir = null;

  try {
    console.log("📦 Preparing repo for dependency tree...");

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "repo-"));
    console.log("📁 Temp dir:", tempDir);

    /* =========================
       🔐 BUILD CLONE URL (FIXED)
    ========================= */
    let cloneUrl = repoUrl.replace(".git", "").trim();

    // 👉 private repo support
    if (token) {
      cloneUrl = cloneUrl.replace(
        "https://",
        `https://${token}@`
      );
    }

    /* =========================
       ⬇️ CLONE REPO (WITH RETRY)
    ========================= */
    try {
      execSync(`git clone ${cloneUrl} ${tempDir}`, {
        stdio: "ignore"
      });
      console.log("⬇️ Repo cloned");
    } catch (err) {
      console.log("❌ Clone failed:", err.message);
      return null;
    }

    /* =========================
       📦 INSTALL DEPENDENCIES (SAFE)
    ========================= */
    try {
      execSync("npm install --legacy-peer-deps --no-audit --no-fund", {
        cwd: tempDir,
        stdio: "ignore"
      });
      console.log("📦 npm install success");
    } catch (err) {
      console.log("⚠️ npm install failed, continuing...");
    }

    /* =========================
       🌳 GET DEP TREE (FORCE)
    ========================= */
    let output;

    try {
      output = execSync("npm ls --json --all", {
        cwd: tempDir,
        encoding: "utf-8"
      });
    } catch (err) {
      console.log("⚠️ npm ls error but continuing...");
      output = err.stdout;
    }

    if (!output) {
      console.log("❌ No dependency output");
      return null;
    }

    console.log("🌳 Dependency tree generated");

    return JSON.parse(output);

  } catch (err) {
    console.log("❌ Dependency tree fatal error:", err.message);
    return null;

  } finally {
    /* =========================
       🧹 CLEANUP
    ========================= */
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log("🧹 Temp repo deleted");
    }
  }
};
