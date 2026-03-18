import mongoose from "mongoose";

export default mongoose.model("Repo", new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  name: String,
  url: String,
  riskScore: Number,
  createdAt: { type: Date, default: Date.now }
}));