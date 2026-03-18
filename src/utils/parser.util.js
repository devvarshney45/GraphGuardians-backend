export const extractDependencies = (pkg) => {
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies
  };

  const result = [];

  for (const name in allDeps) {
    const version = allDeps[name];

    result.push({
      name,
      version,
      cleanVersion: version.replace(/[^0-9.]/g, ""), // 🔥 important
      type: pkg.dependencies?.[name] ? "prod" : "dev",
      parent: null // 🔥 future use (chain)
    });
  }

  return result;
};
