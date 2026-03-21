import axios from "axios";
import User from "../models/user.model.js";
import { getInstallationToken } from "../services/githubApp.service.js";

/* =========================
   📦 GET INSTALLATION REPOS
========================= */
export const getInstallationRepos = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);

    if (!user || !user.installationId) {
      return res.status(400).json({
        msg: "GitHub App not installed"
      });
    }

    /* =========================
       🔐 GET INSTALLATION TOKEN
    ========================= */
    const token = await getInstallationToken(user.installationId);

    /* =========================
       📡 FETCH REPOS FROM GITHUB
    ========================= */
    const response = await axios.get(
      "https://api.github.com/installation/repositories",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json"
        }
      }
    );

    const repos = response.data.repositories;

    /* =========================
       🎯 CLEAN RESPONSE
    ========================= */
    const formatted = repos.map(repo => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      private: repo.private,
      html_url: repo.html_url,
      default_branch: repo.default_branch
    }));

    return res.json({
      count: formatted.length,
      repositories: formatted
    });

  } catch (err) {
    console.log("❌ Get repos error:", err.message);

    return res.status(500).json({
      error: "Failed to fetch repositories"
    });
  }
};
