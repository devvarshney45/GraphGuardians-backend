import mongoose from "mongoose";

const commitSchema = new mongoose.Schema({
  repoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Repo",
    required: true
  },

  message: {
    type: String,
    required: true
  },

  hash: {
    type: String,
    required: true,
    unique: true // ❗ duplicate avoid
  },

  author: {
    name: String,
    email: String
  },

  branch: {
    type: String,
    default: "main"
  },

  commitDate: {
    type: Date // actual commit time from GitHub
  },

  analyzed: {
    type: Boolean,
    default: false // scan hua ya nahi
  },

  createdAt: {
    type: Date,
    default: Date.now
  }

}, { timestamps: true });

export default mongoose.model("Commit", commitSchema);
