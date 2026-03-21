import driver from "../config/neo4j.js";

export const pushToNeo4j = async (
  repoId,
  deps = [],
  vulns = [],
  depEdges = []
) => {
  const session = driver.session();

  try {
    console.log("🧠 Neo4j Sync Started");

    /* =========================
       🔥 STRICT CLEAN (FINAL FIX 💀)
    ========================= */

    const safeDeps = [];
    for (const d of deps) {
      if (d && typeof d.name === "string") {
        safeDeps.push({
          name: d.name.toLowerCase().trim(),
          version: String(d.version || "unknown")
        });
      }
    }

    const safeEdges = [];
    for (const e of depEdges) {
      if (e && typeof e.from === "string" && typeof e.to === "string") {
        safeEdges.push({
          from: e.from.toLowerCase().trim(),
          to: e.to.toLowerCase().trim()
        });
      }
    }

    const safeVulns = [];
    for (const v of vulns) {
      if (v && typeof v.package === "string") {
        safeVulns.push({
          package: v.package.toLowerCase().trim(),
          id: String(v.cve || `${v.package}_unknown`),
          severity: String(v.severity || "UNKNOWN")
        });
      }
    }

    /* =========================
       ROOT
    ========================= */
    const ROOT =
      safeEdges.length > 0
        ? safeEdges[0].from
        : safeDeps[0]?.name || "root";

    /* =========================
       CLEAN OLD GRAPH
    ========================= */
    await session.run(
      `MATCH (r:Repo {id: $repoId})-[*]->(n) DETACH DELETE n`,
      { repoId }
    );

    /* =========================
       CREATE REPO
    ========================= */
    await session.run(
      `MERGE (r:Repo {id: $repoId})`,
      { repoId }
    );

    /* =========================
       ROOT NODE
    ========================= */
    await session.run(
      `MERGE (root:Package {name: $root})`,
      { root: ROOT }
    );

    await session.run(
      `
      MATCH (r:Repo {id: $repoId})
      MATCH (root:Package {name: $root})
      MERGE (r)-[:USES]->(root)
      `,
      { repoId, root: ROOT }
    );

    /* =========================
       PACKAGES
    ========================= */
    for (const dep of safeDeps) {
      await session.run(
        `
        MERGE (p:Package {name: $name})
        SET p.version = $version
        `,
        dep
      );
    }

    /* =========================
       EDGES
    ========================= */
    for (const edge of safeEdges) {
      await session.run(
        `
        MATCH (a:Package {name: $from})
        MATCH (b:Package {name: $to})
        MERGE (a)-[:DEPENDS_ON]->(b)
        `,
        edge
      );
    }

    console.log(`🔗 Dependency edges inserted: ${safeEdges.length}`);

    /* =========================
       VULNERABILITIES
    ========================= */
    for (const v of safeVulns) {
      await session.run(
        `
        MATCH (p:Package {name: $package})
        MERGE (vul:Vulnerability {id: $id})
        SET vul.severity = $severity
        MERGE (p)-[:HAS_VULN]->(vul)
        `,
        v
      );
    }

    console.log(`🚨 Vulnerabilities linked: ${safeVulns.length}`);

    console.log("✅ Neo4j Sync Success");

  } catch (err) {
    console.log("❌ Neo4j Error:", err.message);
  } finally {
    await session.close();
  }
};
