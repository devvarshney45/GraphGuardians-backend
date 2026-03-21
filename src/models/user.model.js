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
      type: String,
      default: ""
    },

    githubAccessToken: {
      type: String,
      select: false // 🔐 never expose
    },

    /* =========================
       🔥 GITHUB APP (CRITICAL)
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
   ⚡ INDEXES
========================= */
userSchema.index({ githubId: 1 });

/* =========================
   🔥 VIRTUALS
========================= */

// ✅ GitHub connected based on installationId
userSchema.virtual("githubConnected").get(function () {
  return !!this.installationId;
});

/* =========================
   🔐 SAFE RESPONSE (FINAL FIX 🔥)
========================= */

userSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    name: this.name || "",
    email: this.email || "",
    avatar: this.avatar || "",

    /* 🔥 CRITICAL FOR FRONTEND FLOW */
    githubUsername: this.githubUsername || "",

    installationId: this.installationId || null,
    githubConnected: !!this.installationId
  };
};

/* =========================
   🔄 STATIC HELPER
========================= */

userSchema.statics.getSafeById = async function (id) {
  const user = await this.findById(id);
  return user ? user.toSafeObject() : null;
};

export default mongoose.model("User", userSchema);
