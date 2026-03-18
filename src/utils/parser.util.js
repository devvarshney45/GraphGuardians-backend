export const extractDependencies = (pkg) => {
  const allDeps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {})
  };

  const result = [];

  for (const name in allDeps) {
    const version = allDeps[name];

    result.push({
      name,
      version,

      // 🔥 clean version (e.g. ^1.2.3 → 1.2.3)
      cleanVersion: version?.replace(/[^0-9.]/g, "") || "",

      // ✅ FIX: schema ke hisaab se
      type: "DIRECT",

      // 🔗 future graph use
      parent: null
    });
  }

  return result;
};