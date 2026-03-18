import mongoose from "mongoose";

const commitAnalysisSchema = new mongoose.Schema({
  repoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Repo",
    required: true
  },

  commitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Commit",
    required: true
  },

  // 🧩 Dependency changes
  addedDependencies: [
    {
      name: String,
      version: String
    }
  ],

  removedDependencies: [
    {
      name: String,
      version: String
    }
  ],

  updatedDependencies: [
    {
      name: String,
      fromVersion: String,
      toVersion: String
    }
  ],

  // 🔴 Vulnerability impact
  newVulnerabilities: [
    {
      package: String,
      severity: String,
      cve: String
    }
  ],

  fixedVulnerabilities: [
    {
      package: String,
      severity: String
    }
  ],

  // 📊 Risk change
  oldRiskScore: Number,
  newRiskScore: Number,

  // 🔥 important flag
  riskIncreased: {
    type: Boolean,
    default: false
  },

  createdAt: {
    type: Date,
    default: Date.now
  }

}, { timestamps: true });

export default mongoose.model("CommitAnalysis", commitAnalysisSchema);
