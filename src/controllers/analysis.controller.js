import Repo from "../models/repo.model.js";
import Dependency from "../models/dependency.model.js";
import Vulnerability from "../models/vulnerability.model.js";
import Alert from "../models/alert.model.js";

import { fetchPackageJson } from "../services/github.service.js";
import { extractDependencies } from "../utils/parser.util.js";
import { checkVulnerabilities } from "../services/vulnerability.service.js";
import { buildGraph } from "../utils/graph.util.js";
import { calculateRisk } from "../utils/risk.util.js";
import { pushToTigerGraph } from "../services/tigergraph.service.js";
import { generateAIInsights } from "../services/ai.service.js";

import {
  compareDependencies,
  findNewVulnerabilities,
  findFixedVulnerabilities,
  generateAlerts
} from "../utils/diff.util.js";

export const analyzeRepo = async (req, res) => {
  try {
    const { url, repoId } = req.body;

    // 🔐 Repo check
    const repo = await Repo.findById(repoId);
    if (!repo) return res.status(404).json({ msg: "Repo not found" });

    if (repo.userId.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    // 🔁 OLD DATA (for diff)
    const oldDeps = await Dependency.find({ repoId }).lean();
    const oldVulns = await Vulnerability.find({ repoId }).lean();

    // 1️⃣ Fetch package.json
    const pkg = await fetchPackageJson(url);

    // 2️⃣ Extract dependencies
    const deps = extractDependencies(pkg);

    // 3️⃣ Compare dependencies 🔥
    const depChanges = compareDependencies(oldDeps, deps);

    // 4️⃣ Reset + save dependencies
    await Dependency.deleteMany({ repoId });

    await Dependency.insertMany(
      deps.map(d => ({
        repoId,
        name: d.name,
        version: d.version,
        cleanVersion: d.cleanVersion,
        type: d.type
      }))
    );

    // 5️⃣ Check vulnerabilities
    const vulns = await checkVulnerabilities(deps);

    // 6️⃣ Reset + save vulnerabilities
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

    // 7️⃣ Diff vulnerabilities 🔥
    const newVulns = findNewVulnerabilities(oldVulns, vulns);
    const fixedVulns = findFixedVulnerabilities(oldVulns, vulns);

    // 8️⃣ Generate alerts 🔔
    const alerts = generateAlerts(repoId, newVulns, fixedVulns);

    if (alerts.length > 0) {
      await Alert.insertMany(alerts);
    }

    // 9️⃣ Build graph
    const graph = buildGraph(deps, vulns, repoId);

    // 🔟 Calculate risk
    const risk = calculateRisk(vulns);

    // 1️⃣1️⃣ AI insights
    const aiInsights = await generateAIInsights(vulns);

    // 1️⃣2️⃣ Push to TigerGraph
    await pushToTigerGraph(repoId, deps, vulns);

    // 1️⃣3️⃣ Update repo
    await Repo.findByIdAndUpdate(repoId, {
      riskScore: risk,
      dependencyCount: deps.length,
      vulnerabilityCount: vulns.length,
      lastScanned: new Date(),
      status: "scanned"
    });

    // 1️⃣4️⃣ Response
    res.json({
      dependencies: deps,
      vulnerabilities: vulns,
      changes: depChanges, // 🔥 NEW
      graph,
      riskScore: risk,
      aiInsights,
      alerts // 🔥 NEW
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
