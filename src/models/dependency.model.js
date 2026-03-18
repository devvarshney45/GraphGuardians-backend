import mongoose from "mongoose";

const dependencySchema = new mongoose.Schema({
  repoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Repo",
    required: true
  },

  // 🔥 NEW: version system
  versionGroup: {
    type: Number,
    required: true
  },

  name: {
    type: String,
    required: true
  },

  version: {
    type: String,
    required: true
  },

  cleanVersion: {
    type: String
  },

  type: {
    type: String,
    enum: ["DIRECT", "TRANSITIVE"],
    default: "DIRECT"
  },

  parent: String,

  isVulnerable: {
    type: Boolean,
    default: false
  },

  severity: {
    type: String,
    enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
  },

  lastScanned: {
    type: Date,
    default: Date.now
  }

}, { timestamps: true });

// 🔥 FIX: versionGroup add karo (important)
dependencySchema.index({ repoId: 1, name: 1, versionGroup: 1 }, { unique: true });

export default mongoose.model("Dependency", dependencySchema);