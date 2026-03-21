import Repo from "../models/repo.model.js";
import { analyzeRepo } from "./analysis.controller.js";
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
      const repoUrl = req.body.repository.html_url.replace(".git", "").trim();
      const installationId = req.body.installation?.id;

      console.log("🚀 Push detected on:", repoUrl);

      if (!installationId) {
        console.log("❌ No installation ID");
        return res.sendStatus(200);
      }

      const repo = await Repo.findOne({ url: repoUrl });

      if (!repo) {
        console.log("⚠️ Repo not found in DB");
        return res.sendStatus(200);
      }

      // 🛑 duplicate protection
      if (repo.lastScanned) {
        const diff = Date.now() - new Date(repo.lastScanned).getTime();
        if (diff < 10000) {
          console.log("⚠️ Skipping duplicate scan");
          return res.sendStatus(200);
        }
      }

      let token;
      try {
        token = await getInstallationToken(installationId);
        console.log("🔐 Installation token generated");
      } catch (err) {
        console.log("❌ Token error:", err.message);
        return res.sendStatus(200);
      }

      /* =========================
         🔥 ASYNC TRIGGER (NON-BLOCKING)
      ========================= */
      analyzeRepo(
        {
          body: {
            url: repoUrl,
            repoId: repo._id,
            token
          },
          user: { id: repo.userId }
        },
        { status: () => ({ json: () => {} }) }
      ).catch(err => {
        console.log("❌ Background analyze failed:", err.message);
      });

      console.log("🚀 Background scan triggered");
    }

    res.sendStatus(200);

  } catch (err) {
    console.log("❌ Webhook error:", err.message);
    res.sendStatus(500);
  }
};
