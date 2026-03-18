import mongoose from "mongoose";

const alertSchema = new mongoose.Schema({
  repoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Repo",
    required: true
  },

  message: {
    type: String,
    required: true
  },

  type: {
    type: String,
    enum: ["NEW_VULNERABILITY", "UPDATED", "FIXED"],
    default: "NEW_VULNERABILITY"
  },

  severity: {
    type: String,
    enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
    default: "HIGH"
  },

  package: {
    type: String // kis dependency se related
  },

  isRead: {
    type: Boolean,
    default: false
  },

  createdAt: {
    type: Date,
    default: Date.now
  }

}, { timestamps: true });

export default mongoose.model("Alert", alertSchema);
