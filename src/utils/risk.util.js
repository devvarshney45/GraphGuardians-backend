export const calculateRisk = (vulns) => {
  if (!vulns.length) return 1;

  let score = 0;

  vulns.forEach(v => {
    if (v.severity === "CRITICAL") score += 3;
    else if (v.severity === "HIGH") score += 2;
    else if (v.severity === "MEDIUM") score += 1;
    else score += 0.5;
  });

  // 🔥 normalize (important)
  score = score / vulns.length;

  // 🎯 scale to 1–10
  const finalScore = Math.min(10, Math.max(1, score * 3));

  return Number(finalScore.toFixed(1));
};
