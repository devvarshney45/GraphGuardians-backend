import mongoose from "mongoose";

const scanHistorySchema = new mongoose.Schema({
  repoId: mongoose.Schema.Types.ObjectId,
  riskScore: Number,
  vulnerabilityCount: Number,
  dependencyCount: Number,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model("ScanHistory", scanHistorySchema);
