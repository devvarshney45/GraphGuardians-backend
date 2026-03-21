import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

export const getDependencyTree = async (repoUrl, token = null) => {
  let tempDir = null;

  try {
    console.log("📦 Preparing repo for dependency tree...");

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "repo-"));
    console.log("📁 Temp dir:", tempDir);

    /* =========================
       🔐 BUILD CLONE URL (FIXED 💀)
    ========================= */
    let cloneUrl = repoUrl.replace(".git", "").trim();

    if (token) {
      cloneUrl = cloneUrl.replace(
        "https://",
        `https://x-access-token:${token}@`
      );
    }

    /* =========================
       ⬇️ CLONE REPO
    ========================= */
    try {
      execSync(`git clone --depth=1 ${cloneUrl} ${tempDir}`, {
        stdio: "ignore"
      });
      console.log("⬇️ Repo cloned");
    } catch (err) {
      console.log("❌ Clone failed:", err.message);
      return null;
    }

    /* =========================
       📦 INSTALL DEPENDENCIES
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
       🌳 GET DEP TREE
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
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log("🧹 Temp repo deleted");
    }
  }
};
