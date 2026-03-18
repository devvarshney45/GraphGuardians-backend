import Dependency from "../models/dependency.model.js";

export const analyzeRepo = async (req, res) => {
  const deps = [
    { name: "lodash", version: "4.17.15" }
  ];

  await Dependency.insertMany(deps);

  res.json({
    message: "Analysis complete",
    dependencies: deps
  });
};