import axios from "axios";

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

    const content = Buffer.from(res.data.content, "base64").toString("utf-8");

    return JSON.parse(content);
  } catch (err) {
    console.log(`⚠️ Failed to fetch ${filePath}`);
    return null;
  }
};

/* =========================
   🌳 LOCKFILE v2/v3 SUPPORT 🔥
========================= */
const buildFromPackages = (packages) => {
  const tree = [];
  const visited = new Set();

  Object.entries(packages).forEach(([path, data]) => {
    if (!data?.name) return;

    const name = data.name.toLowerCase();
    const version = data.version || "unknown";

    // parent extract from path
    const parts = path.split("node_modules/");
    const parent =
      parts.length > 2
        ? parts[parts.length - 2].split("/").pop()
        : null;

    const key = `${name}@${version}_${parent || "root"}`;
    if (visited.has(key)) return;
    visited.add(key);

    tree.push({
      name,
      version,
      parent: parent ? parent.toLowerCase() : null,
      path,
      depth: path.split("node_modules").length
    });
  });

  return tree;
};

/* =========================
   🌳 OLD LOCKFILE SUPPORT
========================= */
const buildFromDependencies = (deps) => {
  const tree = [];
  const visited = new Set();

  const traverse = (deps, parent = null) => {
    if (!deps) return;

    for (const [name, data] of Object.entries(deps)) {
      const version = data.version || "unknown";

      const key = `${name.toLowerCase()}@${version}_${parent || "root"}`;
      if (visited.has(key)) continue;
      visited.add(key);

      tree.push({
        name: name.toLowerCase(),
        version,
        parent: parent ? parent.toLowerCase() : null,
        path: name,
        depth: parent ? 2 : 1
      });

      // 🔥 FIX: only real dependencies
      if (data.dependencies) {
        traverse(data.dependencies, name);
      }
    }
  };

  traverse(deps);
  return tree;
};

/* =========================
   🌐 FALLBACK
========================= */
export const buildFallbackTree = (pkg) => {
  const deps = {
    ...(pkg?.dependencies || {}),
    ...(pkg?.devDependencies || {}),
    ...(pkg?.peerDependencies || {})
  };

  return Object.entries(deps).map(([name, version]) => ({
    name: name.toLowerCase(),
    version: version || "latest",
    parent: null,
    path: name,
    depth: 1
  }));
};

/* =========================
   🚀 MAIN TREE BUILDER
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

    /* =========================
       🔥 LOCKFILE v2/v3
    ========================= */
    if (lockfile?.packages) {
      console.log("✅ LOCKFILE v2/v3 MODE");

      tree = buildFromPackages(lockfile.packages);
    }

    /* =========================
       🔥 LOCKFILE v1
    ========================= */
    else if (lockfile?.dependencies) {
      console.log("✅ LOCKFILE v1 MODE");

      tree = buildFromDependencies(lockfile.dependencies);
    }

    /* =========================
       ⚠️ FALLBACK
    ========================= */
    else {
      console.log("⚠️ FALLBACK MODE");
      tree = buildFallbackTree(pkg);
    }

    /* =========================
       🛑 SAFETY CHECK
    ========================= */
    if (!tree.length) {
      console.log("⚠️ Empty tree → fallback forced");
      tree = buildFallbackTree(pkg);
    }

    console.log(`🌳 FINAL TREE SIZE: ${tree.length}`);

    return tree;

  } catch (err) {
    console.log("❌ Tree error:", err.message);
    return [];
  }
};
