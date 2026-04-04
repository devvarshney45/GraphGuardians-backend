import axios from "axios";
import { Buffer } from "buffer";

/* =========================
🔧 HELPERS
========================= */
const parseRepo = (url) => {
  try {
    const parts = url.split("github.com/")[1]?.split("/");

    if (!parts || parts.length < 2) {
      throw new Error("Invalid GitHub URL");
    }

    return {
      owner: parts[0],
      repo: parts[1].replace(".git", "")
    };
  } catch {
    return {};
  }
};

const getHeaders = (token) => ({
  Accept: "application/vnd.github+json",
  ...(token && { Authorization: `token ${token}` })
});

/* =========================
📥 FETCH FILE
========================= */
const fetchFile = async (owner, repo, filePath, token) => {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

    const res = await axios.get(url, {
      headers: getHeaders(token)
    });

    if (!res.data?.content) {
      console.log(`⚠️ No content in ${filePath}`);
      return null;
    }

    const content = Buffer.from(res.data.content, "base64").toString("utf-8");

    return JSON.parse(content);

  } catch (err) {
    console.log(`⚠️ Failed to fetch ${filePath}:`, err.message);
    return null;
  }
};

/* =========================
🌳 TREE BUILDER (FIXED + DEBUG)
========================= */
export const buildTreeFromLockfile = (lockfile) => {
  const tree = [];
  const visited = new Set();

  const source = lockfile?.packages || lockfile?.dependencies;

  if (!source) {
    console.log("❌ No dependencies/packages found in lockfile");
    return tree;
  }

  console.log("📦 LOCKFILE KEYS SAMPLE:", Object.keys(source).slice(0, 5));

  const traverse = (deps, parent = null, depth = 0) => {
    if (!deps) return;

    for (const [name, data] of Object.entries(deps)) {
      const cleanName = name.replace(/^node_modules\//, "").toLowerCase();
      if (!cleanName) continue;

      const version = data.version || "unknown";
      const key = `${cleanName}@${version}_${parent || "root"}`;

      if (visited.has(key)) continue;
      visited.add(key);

      const node = {
        name: cleanName,
        version,
        parent: parent ? parent.toLowerCase() : null,
        depth: depth + 1
      };

      tree.push(node);

      // 🔥 DEBUG TREE NODE
      if (depth < 2) {
        console.log("🌿 NODE:", node);
      }

      const childDeps = data.dependencies || data.requires;

      if (childDeps && typeof childDeps === "object") {
        traverse(childDeps, cleanName, depth + 1);
      }
    }
  };

  traverse(source);

  console.log("🌳 TREE SIZE:", tree.length);

  // 🔥 DEBUG SAMPLE
  console.log("🌳 TREE SAMPLE:", tree.slice(0, 10));

  // 🔥 BUILD EDGES FOR DEBUG
  const depEdges = tree
    .filter(d => d.parent)
    .map(d => ({
      from: d.parent,
      to: d.name
    }));

  console.log("🔗 DEP EDGES SAMPLE:", depEdges.slice(0, 10));
  console.log("🔗 TOTAL EDGES:", depEdges.length);

  return tree;
};

/* =========================
🌐 FALLBACK
========================= */
export const buildFallbackTree = (pkg) => {
  console.log("⚠️ USING FALLBACK TREE");

  const deps = {
    ...(pkg?.dependencies || {}),
    ...(pkg?.devDependencies || {}),
    ...(pkg?.peerDependencies || {})
  };

  const fallback = Object.entries(deps).map(([name, version]) => ({
    name: name.toLowerCase(),
    version: version || "latest",
    parent: null,
    depth: 1
  }));

  console.log("🌳 FALLBACK TREE:", fallback.slice(0, 10));

  return fallback;
};

/* =========================
🚀 MAIN
========================= */
export const getDependencyTree = async (repoUrl, token = null) => {
  try {
    console.log("⚡ TREE BUILD START");

    const { owner, repo } = parseRepo(repoUrl);

    if (!owner || !repo) {
      console.log("❌ Invalid repo");
      return [];
    }

    const [lockfile, pkg] = await Promise.all([
      fetchFile(owner, repo, "package-lock.json", token),
      fetchFile(owner, repo, "package.json", token)
    ]);

    if (!pkg) {
      console.log("⚠️ No package.json found");
      return [];
    }

    let tree = [];

    if (lockfile?.packages || lockfile?.dependencies) {
      console.log("✅ LOCKFILE MODE");

      tree = buildTreeFromLockfile(lockfile);

      if (!tree.length) {
        console.log("⚠️ EMPTY TREE → FALLBACK");
        tree = buildFallbackTree(pkg);
      }

    } else {
      console.log("⚠️ NO LOCKFILE → FALLBACK");
      tree = buildFallbackTree(pkg);
    }

    console.log(`🌳 FINAL TREE SIZE: ${tree.length}`);

    return tree;

  } catch (err) {
    console.log("❌ Tree error:", err.message);
    return [];
  }
};