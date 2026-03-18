import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },

  password: {
    type: String,
    required: true,
    select: false // 🔐 password hidden by default
  },

  // 🔗 GitHub login support
  githubId: {
    type: String
  },

  avatar: {
    type: String
  },

  // 🧠 role system (future)
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user"
  },

  // ⏱️ tracking
  createdAt: {
    type: Date,
    default: Date.now
  }

}, { timestamps: true });

export default mongoose.model("User", userSchema);
