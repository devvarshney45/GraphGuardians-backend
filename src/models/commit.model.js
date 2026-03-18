import mongoose from "mongoose";

export default mongoose.model("Commit", new mongoose.Schema({
  repoId: mongoose.Schema.Types.ObjectId,
  message: String,
  hash: String,
  createdAt: { type: Date, default: Date.now }
}));