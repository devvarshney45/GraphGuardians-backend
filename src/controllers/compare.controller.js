import Dependency from "../models/dependency.model.js";

export const compareVersions = async (req, res) => {
  try {
    const { repoId } = req.params;
    let { v1, v2 } = req.query;

    /* =========================
       🔥 FIX: TYPE NORMALIZATION
    ========================= */
    const repoIdStr = String(repoId);
    const version1 = Number(v1);
    const version2 = Number(v2);

    if (!version1 || !version2) {
      return res.status(400).json({
        error: "Both versions (v1, v2) are required"
      });
    }

    /* =========================
       ⚡ FETCH DATA (FIXED)
    ========================= */
    const [deps1, deps2] = await Promise.all([
      Dependency.find({
        repoId: repoIdStr,
        versionGroup: version1
      }).lean(),

      Dependency.find({
        repoId: repoIdStr,
        versionGroup: version2
      }).lean()
    ]);

    console.log(`📊 V1 deps: ${deps1.length}`);
    console.log(`📊 V2 deps: ${deps2.length}`);

    /* =========================
       🔥 SAFE VERSION GETTER
    ========================= */
    const getVersion = (d) =>
      d.cleanVersion || d.version || "unknown";

    /* =========================
       🔥 MAP BUILD (FIXED)
    ========================= */
    const map1 = new Map(
      deps1.map(d => [d.name.toLowerCase(), getVersion(d)])
    );

    const map2 = new Map(
      deps2.map(d => [d.name.toLowerCase(), getVersion(d)])
    );

    /* =========================
       🔥 CHANGE DETECTION
    ========================= */
    const changes = {
      added: [],
      removed: [],
      updated: []
    };

    // ✅ ADDED + UPDATED
    map2.forEach((v, name) => {
      if (!map1.has(name)) {
        changes.added.push({
          name,
          version: v
        });
      } else if (map1.get(name) !== v) {
        changes.updated.push({
          name,
          from: map1.get(name),
          to: v
        });
      }
    });

    // ❌ REMOVED
    map1.forEach((v, name) => {
      if (!map2.has(name)) {
        changes.removed.push({
          name,
          version: v
        });
      }
    });

    /* =========================
       📊 SUMMARY (NEW 🔥)
    ========================= */
    const summary = {
      added: changes.added.length,
      removed: changes.removed.length,
      updated: changes.updated.length,
      totalChanges:
        changes.added.length +
        changes.removed.length +
        changes.updated.length
    };

    /* =========================
       🎯 FINAL RESPONSE
    ========================= */
    return res.json({
      versions: {
        from: version1,
        to: version2
      },
      summary,
      changes
    });

  } catch (err) {
    console.log("❌ Compare error:", err.message);

    return res.status(500).json({
      error: "Failed to compare versions"
    });
  }
};
