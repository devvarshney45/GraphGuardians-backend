import Commit from "../models/commit.model.js";

export const getCommits = async (req, res) => {
  res.json(await Commit.find());
};