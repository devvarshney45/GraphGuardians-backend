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

  health: Number,

  vulnerabilityCount: {
    type: Number,
    default: 0
  },

  dependencyCount: {
    type: Number,
    default: 0
  },

  // ⏱️ tracking
  lastScanned: Date,

  // 🔥 UPDATED STATUS (IMPORTANT)
  status: {
    type: String,
    enum: ["idle", "scanning", "scanned", "error"],
    default: "idle"
  },

  webhookEnabled: {
    type: Boolean,
    default: false
  },

  scanCount:{
    type:Number,
    default:0
  },
  githubToken:String

}, { timestamps: true });

// ❗ prevent duplicate repo per user
repoSchema.index({ userId: 1, url: 1 }, { unique: true });

export default mongoose.model("Repo", repoSchema);