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
      type: String,
      default: ""
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
      type: String,
      select: false // 🔐 never send to frontend
    },

    /* =========================
       🔥 GITHUB APP
    ========================= */
    installationId: {
      type: Number,
      default: null
    },

    /* =========================
       🧠 ROLE SYSTEM
    ========================= */
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user"
    },

    /* =========================
       🔔 NOTIFICATIONS
    ========================= */
    fcmTokens: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

/* =========================
   ⚡ INDEXES (FIXED)
========================= */

// ❌ duplicate avoid kiya
// email already unique hai, dubara index nahi chahiye

userSchema.index({ githubId: 1 });

/* =========================
   🔥 VIRTUAL FIELD
========================= */

// frontend ke liye
userSchema.virtual("githubConnected").get(function () {
  return !!this.installationId;
});

/* =========================
   🔥 SAFE RESPONSE
========================= */

// jo frontend ko bhejna hai
userSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    avatar: this.avatar,
    installationId: this.installationId,
    githubConnected: !!this.installationId
  };
};

export default mongoose.model("User", userSchema);