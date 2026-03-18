import mongoose from "mongoose";

const dependencySchema = new mongoose.Schema(
  {
    repoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Repo",
      required: true,
      index: true
    },

    // 🔥 Version system (v1, v2, v3...)
    versionGroup: {
      type: Number,
      required: true,
      index: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    version: {
      type: String,
      required: true
    },

    cleanVersion: {
      type: String
    },

    // 🧩 Dependency type
    type: {
      type: String,
      enum: ["DIRECT", "TRANSITIVE"],
      default: "DIRECT"
    },

    // 🔗 Parent dependency (for graph chain)
    parent: {
      type: String,
      default: null
    },

    // 🔴 Vulnerability flag
    isVulnerable: {
      type: Boolean,
      default: false
    },

    // 📊 Severity (if vulnerable)
    severity: {
      type: String,
      enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
      default: null
    },

    // ⏱️ Scan timestamp
    lastScanned: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

/* =========================
   🔥 INDEXES (IMPORTANT)
========================= */

// ❗ Unique per version (NO DUPLICATE IN SAME SCAN)
dependencySchema.index(
  { repoId: 1, name: 1, versionGroup: 1 },
  { unique: true }
);

// ⚡ Fast queries (latest scan)
dependencySchema.index({ repoId: 1, versionGroup: -1 });

// ⚡ Fast lookup (dependency search)
dependencySchema.index({ name: 1 });

export default mongoose.model("Dependency", dependencySchema);