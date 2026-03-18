import Repo from "../models/repo.model.js";
import Dependency from "../models/dependency.model.js";
import Vulnerability from "../models/vulnerability.model.js";

export const downloadReport = async (req, res) => {
  try {
    const { repoId } = req.params;

    // 🔐 repo check
    const repo = await Repo.findById(repoId);
    if (!repo) return res.status(404).json({ msg: "Repo not found" });

    if (repo.userId.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    // 📦 data fetch
    const deps = await Dependency.find({ repoId });
    const vulns = await Vulnerability.find({ repoId });

    // 📊 severity count
    let critical = 0, high = 0, medium = 0, low = 0;

    vulns.forEach(v => {
      if (v.severity === "CRITICAL") critical++;
      else if (v.severity === "HIGH") high++;
      else if (v.severity === "MEDIUM") medium++;
      else low++;
    });

    // 📄 report object
    const report = {
      repo: {
        name: repo.name,
        url: repo.url,
        scannedAt: repo.lastScanned
      },
      summary: {
        riskScore: repo.riskScore,
        totalDependencies: deps.length,
        totalVulnerabilities: vulns.length,
        severity: { critical, high, medium, low }
      },
      vulnerabilities: vulns
    };

    // 🔥 send as downloadable JSON
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=report-${repo._id}.json`
    );

    res.json(report);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
