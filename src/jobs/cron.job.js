import cron from "node-cron";
import Repo from "../models/repo.model.js";
import { analyzeRepo } from "../controllers/analysis.controller.js";

export const startCron = () => {
  // ⏰ every 1 hour
  cron.schedule("0 * * * *", async () => {
    console.log("🔄 Running scheduled scan...");

    try {
      const repos = await Repo.find();

      for (const repo of repos) {
        console.log("🔍 Scanning:", repo.name);

        try {
          await analyzeRepo(
            {
              body: {
                url: repo.url,
                repoId: repo._id,
                token: null // optional (if stored later)
              },
              user: {
                id: repo.userId.toString() // 🔥 VERY IMPORTANT
              }
            },
            {
              status: () => ({
                json: () => {}
              }),
              json: () => {}
            }
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