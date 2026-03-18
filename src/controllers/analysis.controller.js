import Repo from "../models/repo.model.js";
import Dependency from "../models/dependency.model.js";
import Vulnerability from "../models/vulnerability.model.js";
import Alert from "../models/alert.model.js";

import { fetchPackageJson } from "../services/github.service.js";
import { extractDependencies } from "../utils/parser.util.js";
import { checkVulnerabilities } from "../services/vulnerability.service.js";
import { buildGraph } from "../services/graph.service.js";
import { calculateRisk } from "../utils/risk.util.js";
import { pushToTigerGraph } from "../services/tigergraph.service.js";
import { generateAIInsights } from "../services/ai.service.js";

export const analyzeRepo = async (req, res) => {
  try {
    const { url, repoId } = req.body;

    // 🔐 Repo check
    const repo = await Repo.findById(repoId);
    if (!repo) return res.status(404).json({ msg: "Repo not found" });

    if (repo.userId.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    // 1. Fetch package.json
    const pkg = await fetchPackageJson(url);

    // 2. Extract dependencies
    const deps = extractDependencies(pkg);

    // 3. Reset old dependencies
    await Dependency.deleteMany({ repoId });

    await Dependency.insertMany(
      deps.map(d => ({
        repoId,
        name: d.name,
        version: d.version
      }))
    );

    // 4. Check vulnerabilities
    const vulns = await checkVulnerabilities(deps);

    // 5. Reset old vulnerabilities
    await Vulnerability.deleteMany({ repoId });

    await Vulnerability.insertMany(
      vulns.map(v => ({
        repoId,
        package: v.package,
        version: v.version,
        severity: v.severity,
        description: v.description,
        cve: v.cve,
        fix: v.fix
      }))
    );

    // 6. Build graph
    const graph = buildGraph(deps, vulns, repo);

    // 7. Calculate risk
    const risk = calculateRisk(vulns);

    // 8. AI insights 🔥
    const aiInsights = await generateAIInsights(vulns);

    // 9. Push to TigerGraph
    await pushToTigerGraph(repoId, deps, vulns);

    // 10. Create alert if needed
    if (vulns.length > 0) {
      await Alert.create({
        repoId,
        message: `⚠️ ${vulns.length} vulnerabilities detected`,
        severity: "HIGH"
      });
    }

    // 11. Update repo
    await Repo.findByIdAndUpdate(repoId, {
      riskScore: risk,
      dependencyCount: deps.length,
      vulnerabilityCount: vulns.length,
      lastScanned: new Date(),
      status: "scanned"
    });

    // 12. Response
    res.json({
      dependencies: deps,
      vulnerabilities: vulns,
      graph,
      riskScore: risk,
      aiInsights
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
