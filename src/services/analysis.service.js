import Dependency from "../models/dependency.model.js";
import Vulnerability from "../models/vulnerability.model.js";
import Alert from "../models/alert.model.js";
import Repo from "../models/repo.model.js";

import { fetchPackageJson } from "./github.service.js";
import { extractDependencies } from "../utils/parser.util.js";
import { checkVulnerabilities } from "./vulnerability.service.js";
import { buildGraph } from "./graph.service.js";
import { calculateRisk } from "../utils/risk.util.js";
import { pushToTigerGraph } from "./tigergraph.service.js";
import { generateAIInsights } from "./ai.service.js";

export const runAnalysis = async (url, repoId) => {
  try {
    // 1. Fetch package.json
    const pkg = await fetchPackageJson(url);

    // 2. Extract dependencies
    const deps = extractDependencies(pkg);

    // 3. Save dependencies
    await Dependency.deleteMany({ repoId }); // reset old
    await Dependency.insertMany(
      deps.map(d => ({
        repoId,
        name: d.name,
        version: d.version,
        cleanVersion: d.version.replace(/[^0-9.]/g, "")
      }))
    );

    // 4. Check vulnerabilities
    const vulns = await checkVulnerabilities(deps);

    // 5. Save vulnerabilities
    await Vulnerability.deleteMany({ repoId });

    await Vulnerability.insertMany(
      vulns.map(v => ({
        repoId,
        package: v.package,
        version: v.version,
        severity: v.severity,
        description: v.description,
        fix: `npm update ${v.package}`
      }))
    );

    // 6. Build graph
    const graph = buildGraph(deps, vulns);

    // 7. Risk score
    const risk = calculateRisk(vulns);

    // 8. AI insights
    const aiInsights = await generateAIInsights(vulns);

    // 9. TigerGraph push
    await pushToTigerGraph(repoId, deps, vulns);

    // 10. Alerts (if vulnerabilities found)
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

    return {
      dependencies: deps,
      vulnerabilities: vulns,
      graph,
      riskScore: risk,
      aiInsights
    };

  } catch (err) {
    console.log("Analysis Error:", err.message);
    throw err;
  }
};
