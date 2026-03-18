
import mongoose from "mongoose";

const dependencySchema = new mongoose.Schema({
  repoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Repo",
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

  // 🧠 cleaned version (e.g. 4.17.15)
  cleanVersion: {
    type: String
  },

  // 🧩 dependency type
  type: {
    type: String,
    enum: ["DIRECT", "TRANSITIVE"],
    default: "DIRECT"
  },

  // 🔗 parent dependency (for chain)
  parent: {
    type: String // e.g. axios → lodash
  },

  // 🔴 vulnerability flag
  isVulnerable: {
    type: Boolean,
    default: false
  },

  // 📊 severity (if vulnerable)
  severity: {
    type: String,
    enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
  },

  // ⏱️ last scan time
  lastScanned: {
    type: Date,
    default: Date.now
  }

}, { timestamps: true });

// ❗ prevent duplicate same dependency per repo
dependencySchema.index({ repoId: 1, name: 1 }, { unique: true });

export default mongoose.model("Dependency", dependencySchema);
