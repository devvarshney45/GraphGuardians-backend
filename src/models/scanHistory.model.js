import mongoose from "mongoose";

const scanHistorySchema = new mongoose.Schema({
  repoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Repo",
    required: true,
    index: true
  },
  version: {
    type: Number,
    required: true
  },
  riskScore: { type: Number, default: 0 },
  vulnerabilityCount: { type: Number, default: 0 },
  dependencyCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model("ScanHistory", scanHistorySchema);