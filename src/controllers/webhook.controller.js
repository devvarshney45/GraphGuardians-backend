import Repo from "../models/repo.model.js";
import { runAnalysis } from "../services/analysis.service.js"; // ✅ FIXED
import { getInstallationToken } from "../services/githubApp.service.js";

export const githubWebhook = async (req, res) => {
  try {
    const event = req.headers["x-github-event"];

    console.log("\n📡 ===============================");
    console.log("📡 GitHub Event:", event);
    console.log("==================================");

    /* =========================
       🚀 PUSH EVENT
    ========================= */
    if (event === "push") {
      const repoUrl = req.body.repository.html_url
        .replace(".git", "")
        .trim();

      const installationId = req.body.installation?.id;

      console.log("🚀 Push detected on:", repoUrl);

      if (!installationId) {
        console.log("❌ No installation ID");
        return res.sendStatus(200);
      }

      /* =========================
         🔍 FIND REPO
      ========================= */
      const repo = await Repo.findOne({ url: repoUrl });

      if (!repo) {
        console.log("⚠️ Repo not found in DB");
        return res.sendStatus(200);
      }

      /* =========================
         🛑 DUPLICATE PROTECTION
      ========================= */
      if (repo.lastScanned) {
        const diff = Date.now() - new Date(repo.lastScanned).getTime();

        if (diff < 10000) {
          console.log("⚠️ Skipping duplicate scan (within 10s)");
          return res.sendStatus(200);
        }
      }

      console.log("📦 Repo:", repo.name);
      console.log("🆔 Repo ID:", repo._id);

      /* =========================
         🔐 GET INSTALLATION TOKEN
      ========================= */
      let token;

      try {
        token = await getInstallationToken(installationId);
        console.log("🔐 Installation token generated");
      } catch (err) {
        console.log("❌ Token error:", err.message);
        return res.sendStatus(200);
      }

      /* =========================
         🔥 RUN ANALYSIS (FINAL FIX)
      ========================= */
      try {
        console.log("🚀 Starting full analysis...");

        await runAnalysis(repoUrl, repo._id, token); // ✅ SERVICE CALL

        console.log("✅ Full analysis completed");

      } catch (err) {
        console.log("❌ Analysis failed:", err.message);
      }
    }

    /* =========================
       DEFAULT RESPONSE
    ========================= */
    res.sendStatus(200);

  } catch (err) {
    console.log("❌ Webhook error:", err.message);
    res.sendStatus(500);
  }
};
