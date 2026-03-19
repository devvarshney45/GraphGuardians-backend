import Repo from "../models/repo.model.js";
import { analyzeRepo } from "./analysis.controller.js";
import { getInstallationToken } from "../services/githubApp.service.js";

export const githubWebhook = async (req, res) => {
  try {
    const event = req.headers["x-github-event"];

    console.log("📡 GitHub Event:", event);

    if (event === "push") {
      const repoUrl = req.body.repository.html_url
        .replace(".git", "")
        .trim();

      const installationId = req.body.installation?.id;

      console.log("🚀 Push detected:", repoUrl);

      if (!installationId) {
        console.log("❌ No installation ID");
        return res.sendStatus(200);
      }

      const repo = await Repo.findOne({ url: repoUrl });

      if (!repo) {
        console.log("⚠️ Repo not found in DB");
        return res.sendStatus(200);
      }

      // 🔥 Prevent duplicate scans
      if (
        repo.lastScanned &&
        Date.now() - new Date(repo.lastScanned).getTime() < 10000
      ) {
        console.log("⚠️ Skipping duplicate scan");
        return res.sendStatus(200);
      }

      console.log("📦 Repo URL:", repoUrl);
      console.log("🆔 Installation ID:", installationId);

      const token = await getInstallationToken(installationId);

      await analyzeRepo(
        {
          body: {
            url: repoUrl,
            repoId: repo._id,
            token
          },
          user: { id: repo.userId }
        },
        { json: () => {} }
      );

      console.log("✅ Auto scan completed via webhook");
    }

    res.sendStatus(200);

  } catch (err) {
    console.log("❌ Webhook error:", err.message);
    res.sendStatus(500);
  }
};