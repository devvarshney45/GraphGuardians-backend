import Repo from "../models/repo.model.js";
import User from "../models/user.model.js";
import { runAnalysis } from "../services/analysis.service.js";
import { getInstallationToken } from "../services/githubApp.service.js";

export const githubWebhook = async (req, res) => {
  try {
    const event = req.headers["x-github-event"];

    console.log("\n📡 ===============================");
    console.log("📡 GitHub Event:", event);
    console.log("==================================");

    /* =========================
       🔥 INSTALL EVENT (FIXED)
    ========================= */
    if (event === "installation") {
      const installationId = req.body.installation?.id;
      const username = req.body.installation?.account?.login;

      console.log("🆔 Installation ID:", installationId);
      console.log("👤 GitHub Username:", username);

      if (!installationId || !username) {
        console.log("❌ Missing data");
        return res.sendStatus(200);
      }

      const user = await User.findOne({
        githubUsername: username
      });

      if (!user) {
        console.log("❌ User not found for:", username);
        return res.sendStatus(200);
      }

      user.installationId = Number(installationId);
      await user.save();

      console.log("✅ Installation saved in DB");
    }

    /* =========================
       🚀 PUSH EVENT
    ========================= */
    if (event === "push") {
      const repoUrl = req.body.repository.html_url
        .replace(".git", "")
        .trim();

      const installationId = req.body.installation?.id;

      if (!installationId) return res.sendStatus(200);

      const repo = await Repo.findOne({ url: repoUrl });
      if (!repo) return res.sendStatus(200);

      let token;
      try {
        token = await getInstallationToken(installationId);
      } catch {
        return res.sendStatus(200);
      }

      await runAnalysis(repoUrl, repo._id, token);
    }

    res.sendStatus(200);

  } catch (err) {
    console.log("❌ Webhook error:", err.message);
    res.sendStatus(500);
  }
};
