import mongoose from "mongoose";

const dependencySchema = new mongoose.Schema(
  {
    repoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Repo",
      required: true,
      index: true
    },
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
    type: {
      type: String,
      enum: ["prod", "dev", "peer", "DIRECT", "TRANSITIVE"],
      default: "prod"
    },
    parent: {
      type: String,
      default: null
    },
    isVulnerable: {
      type: Boolean,
      default: false
    },
    severity: {
      type: String,
      enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW", null],
      default: null
    },
    lastScanned: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

dependencySchema.index(
  { repoId: 1, name: 1, versionGroup: 1 },
  { unique: true }
);
dependencySchema.index({ repoId: 1, versionGroup: -1 });
dependencySchema.index({ name: 1 });

export default mongoose.model("Dependency", dependencySchema);