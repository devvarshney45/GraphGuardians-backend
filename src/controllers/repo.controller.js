import Repo from "../models/repo.model.js";

export const addRepo = async (req, res) => {
  const repo = await Repo.create(req.body);
  res.json(repo);
};

export const getRepos = async (req, res) => {
  res.json(await Repo.find());
};