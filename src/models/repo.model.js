import mongoose from "mongoose";

const repoSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  name: {
    type: String,
    required: true
  },

  url: {
    type: String,
    required: true
  },

  // 🔐 private repo support
  isPrivate: {
    type: Boolean,
    default: false
  },

  // ⭐ GitHub metadata
  stars: Number,
  forks: Number,
  language: String,

  // 📊 analysis data
  riskScore: {
    type: Number,
    default: 0
  },

  health: {
    type: Number // %
  },

  vulnerabilityCount: {
    type: Number,
    default: 0
  },

  dependencyCount: {
    type: Number,
    default: 0
  },

  // ⏱️ tracking
  lastScanned: {
    type: Date
  },

  // 🔄 status
  status: {
    type: String,
    enum: ["pending", "scanned", "error"],
    default: "pending"
  },

  // 🔗 webhook enabled
  webhookEnabled: {
    type: Boolean,
    default: false
  },

  createdAt: {
    type: Date,
    default: Date.now
  }

}, { timestamps: true });

// ❗ prevent duplicate repo per user
repoSchema.index({ userId: 1, url: 1 }, { unique: true });

export default mongoose.model("Repo", repoSchema);
