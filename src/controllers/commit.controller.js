import Commit from "../models/commit.model.js";

export const getCommits = async (req, res) => {
  res.json(await Commit.find());
};
export const githubWebhook = async (req, res) => {
  const { repository } = req.body;

  console.log("New commit in:", repository.full_name);

  // yaha re-analyze trigger kar sakta hai

  res.sendStatus(200);
};