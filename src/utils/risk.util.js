export const calculateRisk = (vulns) => {
  if (!vulns.length) return 1;

  let score = 0;

  vulns.forEach(v => {
    if (v.severity === "HIGH") score += 2;
    else score += 1;
  });

  return Math.min(10, score);
};