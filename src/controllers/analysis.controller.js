
import Dependency from "../models/dependency.model.js";
import { fetchPackageJson } from "../services/github.service.js";
import { extractDependencies } from "../utils/parser.util.js";
import { checkVulnerabilities } from "../services/vulnerability.service.js";
import { buildGraph } from "../services/graph.service.js";
import { calculateRisk } from "../utils/risk.util.js";
import { pushToTigerGraph } from "../services/tigergraph.service.js";

export const analyzeRepo = async (req, res) => {
  try {
    const { url } = req.body;

    const pkg = await fetchPackageJson(url);

    const deps = extractDependencies(pkg);

    const vulns = await checkVulnerabilities(deps);

    const graph = buildGraph(deps, vulns);

    const risk = calculateRisk(vulns);

    res.json({
      dependencies: deps,
      vulnerabilities: vulns,
      graph,
      riskScore: risk
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const graph = buildGraph(deps, vulns);
const risk = calculateRisk(vulns);

// 🔥 ADD THIS
await pushToTigerGraph("repo123", deps, vulns);

res.json({
  dependencies: deps,
  vulnerabilities: vulns,
  graph,
  riskScore: risk
});