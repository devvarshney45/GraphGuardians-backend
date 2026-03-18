export const extractDependencies = (pkg) => {
  const deps = pkg.dependencies || {};
  return Object.keys(deps).map(name => ({
    name,
    version: deps[name]
  }));
};