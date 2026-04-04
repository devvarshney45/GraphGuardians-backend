import mongoose from "mongoose";

const alertSchema = new mongoose.Schema(
  {
    /* =========================
       🔗 REPO REFERENCE
    ========================= */
    repoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Repo",
      required: true,
      index: true // 🔥 performance boost
    },

    /* =========================
       📝 ALERT MESSAGE
    ========================= */
    message: {
      type: String,
      required: true,
      trim: true
    },

    /* =========================
       🏷️ TYPE
    ========================= */
    type: {
      type: String,
      enum: ["NEW_VULNERABILITY", "UPDATED", "FIXED"],
      default: "NEW_VULNERABILITY",
      index: true
    },

    /* =========================
       ⚠️ SEVERITY
    ========================= */
    severity: {
      type: String,
      enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
      default: "HIGH",
      index: true
    },

    /* =========================
       📦 PACKAGE NAME
    ========================= */
    package: {
      type: String,
      trim: true,
      index: true
    },

    /* =========================
       👁️ READ STATUS
    ========================= */
    isRead: {
      type: Boolean,
      default: false,
      index: true
    },

    /* =========================
       🧠 EXTRA METADATA (FUTURE USE)
    ========================= */
    meta: {
      type: Object,
      default: {}
    }
  },
  {
    timestamps: true // 🔥 createdAt + updatedAt auto
  }
);

/* =========================
   ⚡ COMPOUND INDEX (FAST QUERY)
========================= */
alertSchema.index({ repoId: 1, createdAt: -1 });

export default mongoose.model("Alert", alertSchema);
