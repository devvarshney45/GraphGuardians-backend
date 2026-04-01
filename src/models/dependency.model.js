import mongoose from "mongoose";

const dependencySchema = new mongoose.Schema(
  {
    /* =========================
       🔗 REPO REF (FIXED)
    ========================= */
    repoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Repo",
      required: true,
      index: true
    },

    /* =========================
       🔥 VERSION SYSTEM
    ========================= */
    versionGroup: {
      type: Number,
      required: true,
      index: true
    },

    /* =========================
       📦 PACKAGE INFO
    ========================= */
    name: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,        // 🔥 FIX (consistency)
      index: true
    },

    version: {
      type: String,
      required: true,
      trim: true
    },

    cleanVersion: {
      type: String,
      trim: true
    },

    /* =========================
       🧩 TYPE
    ========================= */
    type: {
      type: String,
      enum: ["DIRECT", "TRANSITIVE"],
      default: "DIRECT",
      index: true
    },

    /* =========================
       🔗 CHAIN SUPPORT (IMPORTANT)
    ========================= */
    parent: {
      type: String,
      default: null,
      lowercase: true,
      index: true
    },

    /* =========================
       📍 EXTRA GRAPH INFO
    ========================= */
    path: {
      type: String,          // lodash->express->body-parser
      default: null
    },

    depth: {
      type: Number,
      default: 1,
      index: true
    },

    /* =========================
       🔴 VULNERABILITY FLAGS
    ========================= */
    isVulnerable: {
      type: Boolean,
      default: false,
      index: true
    },

    severity: {
      type: String,
      enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
      default: null,
      index: true
    },

    /* =========================
       ⏱️ TIMESTAMP
    ========================= */
    lastScanned: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

/* =========================
   🔥 INDEXES (CRITICAL)
========================= */

// ❗ UNIQUE PER VERSION (FIXED)
dependencySchema.index(
  { repoId: 1, name: 1, versionGroup: 1 },
  { unique: true }
);

// ⚡ FAST LATEST FETCH
dependencySchema.index({ repoId: 1, versionGroup: -1 });

// ⚡ GRAPH TRAVERSAL
dependencySchema.index({ parent: 1 });

// ⚡ VULN FILTER
dependencySchema.index({ repoId: 1, isVulnerable: 1 });

// ⚡ SEVERITY FILTER
dependencySchema.index({ repoId: 1, severity: 1 });

export default mongoose.model("Dependency", dependencySchema);
