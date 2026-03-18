import mongoose from "mongoose";

export default mongoose.model("Dependency", new mongoose.Schema({
  repoId: mongoose.Schema.Types.ObjectId,
  name: String,
  version: String
}));