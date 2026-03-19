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
       🟢 INSTALLATION EVENTS
    ========================= */
    if (event === "installation") {
      const action = req.body.action;

      console.log("🔧 Installation Event:", action);

      // when user installs GitHub App
      if (action === "created") {
        const installationId = req.body.installation.id;
        const account = req.body.installation.account?.login;

        console.log("✅ App Installed by:", account);
        console.log("🆔 Installation ID:", installationId);

        // 👉 optional: save installationId in user DB
      }

      return res.sendStatus(200);
    }

    /* =========================
       🚀 PUSH EVENT (MAIN FLOW)
    ========================= */
    if (event === "push") {
      const repoUrl = req.body.repository.html_url
        .replace(".git", "")
        .trim();

      const installationId = req.body.installation?.id;

      console.log("🚀 Push detected on:", repoUrl);

      if (!installationId) {
        console.log("❌ No installation ID (App not installed)");
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
      console.log("🆔 Installation ID:", installationId);

      /* =========================
         🔐 GET INSTALLATION TOKEN
      ========================= */
      let token;

      try {
        token = await getInstallationToken(installationId);
        console.log("🔐 Installation token generated");
      } catch (err) {
        console.log("❌ Token generation failed:", err.message);
        return res.sendStatus(200);
      }

      /* =========================
         🔥 AUTO ANALYZE
      ========================= */
      try {
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

      } catch (err) {
        console.log("❌ Analyze failed:", err.message);
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