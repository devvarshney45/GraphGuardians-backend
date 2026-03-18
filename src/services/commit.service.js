import Commit from "../models/commit.model.js";
import CommitAnalysis from "../models/commitAnalysis.model.js";
import Repo from "../models/repo.model.js";

import { runAnalysis } from "./analysis.service.js";

// 🔁 Handle new commit (webhook se call hoga)
export const processCommit = async (repo, commits) => {
  try {
    for (const c of commits) {

      // ❌ skip if already exists
      const exists = await Commit.findOne({ hash: c.id });
      if (exists) continue;

      // ✅ save commit
      const newCommit = await Commit.create({
        repoId: repo._id,
        message: c.message,
        hash: c.id,
        author: {
          name: c.author?.name,
          email: c.author?.email
        },
        commitDate: c.timestamp
      });

      // 🧠 OLD state
      const oldRisk = repo.riskScore || 0;

      // 🔄 run fresh analysis
      const result = await runAnalysis(repo.url, repo._id);

      const newRisk = result.riskScore;

      // ⚠️ detect risk change
      const riskIncreased = newRisk > oldRisk;

      // 🔍 detect new vulnerabilities
      const newVulns = result.vulnerabilities;

      // 📝 save commit analysis
      await CommitAnalysis.create({
        repoId: repo._id,
        commitId: newCommit._id,
        newVulnerabilities: newVulns.map(v => ({
          package: v.package,
          severity: v.severity
        })),
        oldRiskScore: oldRisk,
        newRiskScore: newRisk,
        riskIncreased
      });

      // 🔥 mark analyzed
      newCommit.analyzed = true;
      await newCommit.save();

      console.log("✅ Commit processed:", c.id);
    }

  } catch (err) {
    console.log("Commit Service Error:", err.message);
  }
};
