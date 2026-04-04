import cron from "node-cron";
import Repo from "../models/repo.model.js";
import { analyzeRepo } from "../controllers/analysis.controller.js";

// ✅ FIXED: proper fake res object
const fakeRes = {
  status: function() { return this; },  // chaining support
  json: function() { return this; }
};

export const startCron = () => {
  cron.schedule("0 * * * *", async () => {
    console.log("🔄 Running scheduled scan...");

    try {
      const repos = await Repo.find({ status: "scanned" }); // ✅ sirf scanned repos

      for (const repo of repos) {
        console.log("🔍 Scanning:", repo.name);

        try {
          await analyzeRepo(
            {
              body: {
                url: repo.url,
                repoId: repo._id,
                token: repo.githubToken || null
              },
              user: {
                id: repo.userId.toString()
              },
              app: { get: () => null } // ✅ req.app.get("io") crash fix
            },
            fakeRes
          );
        } catch (err) {
          console.log(`❌ Failed scan for ${repo.name}:`, err.message);
        }
      }

      console.log("✅ Cron scan completed");

    } catch (err) {
      console.log("❌ Cron error:", err.message);
    }
  });
};