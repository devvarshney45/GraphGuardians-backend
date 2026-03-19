import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    /* =========================
       👤 BASIC INFO
    ========================= */
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      select: false // 🔐 hidden by default
    },

    avatar: {
      type: String
    },

    /* =========================
       🔗 GITHUB OAUTH
    ========================= */
    githubId: {
      type: String,
      index: true
    },

    githubUsername: {
      type: String
    },

    githubAccessToken: {
      type: String // 🔥 OAuth token (optional use)
    },

    /* =========================
       🔥 GITHUB APP (IMPORTANT)
    ========================= */
    installationId: {
      type: Number // 🔥 used for auto token generation
    },

    /* =========================
       🧠 ROLE SYSTEM
    ========================= */
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user"
    }
  },
  { timestamps: true }
);

/* =========================
   ⚡ INDEXES (PERFORMANCE)
========================= */

userSchema.index({ email: 1 });
userSchema.index({ githubId: 1 });

export default mongoose.model("User", userSchema);