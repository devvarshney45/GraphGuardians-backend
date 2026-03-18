import Dependency from "../models/dependency.model.js";
import { fetchPackageJson } from "../services/github.service.js";
import { extractDependencies } from "../utils/parser.util.js";
import { checkVulnerabilities } from "../services/vulnerability.service.js";
import { buildGraph } from "../services/graph.service.js";
import { calculateRisk } from "../utils/risk.util.js";
import { pushToTigerGraph } from "../services/tigergraph.service.js";

export const analyzeRepo = async (req, res) => {
  try {
    const { url, repoId } = req.body;

    // 1. Fetch package.json
    const pkg = await fetchPackageJson(url);

    // 2. Extract dependencies
    const deps = extractDependencies(pkg);

    // 3. Save dependencies (IMPORTANT)
    await Dependency.insertMany(
      deps.map(d => ({ ...d, repoId }))
    );

    // 4. Check vulnerabilities
    const vulns = await checkVulnerabilities(deps);

    // 5. Build graph
    const graph = buildGraph(deps, vulns);

    // 6. Calculate risk
    const risk = calculateRisk(vulns);

    // 7. Push to TigerGraph 🔥
    await pushToTigerGraph(repoId, deps, vulns);

    // 8. Response
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
