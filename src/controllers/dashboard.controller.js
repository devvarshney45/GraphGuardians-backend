export const getDashboard = async (req, res) => {
  res.json({
    riskScore: 8.5,
    vulnerabilities: 5,
    dependencies: 20,
    health: "Good"
  });
};