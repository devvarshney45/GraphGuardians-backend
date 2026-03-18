import mongoose from "mongoose";

export default mongoose.model("Alert", new mongoose.Schema({
  repoId: mongoose.Schema.Types.ObjectId,
  message: String,
  createdAt: { type: Date, default: Date.now }
}));