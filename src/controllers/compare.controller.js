import Dependency from "../models/dependency.model.js";

export const compareVersions = async (req, res) => {
  try {
    const { repoId } = req.params;
    const { v1, v2 } = req.query;

    const deps1 = await Dependency.find({
      repoId,
      versionGroup: v1
    });

    const deps2 = await Dependency.find({
      repoId,
      versionGroup: v2
    });

    const map1 = new Map(deps1.map(d => [d.name, d.cleanVersion]));
    const map2 = new Map(deps2.map(d => [d.name, d.cleanVersion]));

    const changes = {
      added: [],
      removed: [],
      updated: []
    };

    map2.forEach((v, name) => {
      if (!map1.has(name)) {
        changes.added.push(name);
      } else if (map1.get(name) !== v) {
        changes.updated.push(name);
      }
    });

    map1.forEach((v, name) => {
      if (!map2.has(name)) {
        changes.removed.push(name);
      }
    });

    res.json({ changes });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};