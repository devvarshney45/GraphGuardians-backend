import app from "./src/app.js";
import dotenv from "dotenv";
import connectDB from "./src/config/db.js";

// 🔐 Load env
dotenv.config();

/* =========================
   🔥 START SERVER FUNCTION
========================= */
const startServer = async () => {
  try {
    // 🗄️ DB connect
    await connectDB();
    console.log("✅ MongoDB connected");

    const PORT = process.env.PORT || 5000;

    // 🚀 Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (err) {
    console.log("❌ Server start error:", err.message);
    process.exit(1);
  }
};

/* =========================
   ⚠️ GLOBAL ERROR HANDLING
========================= */
process.on("unhandledRejection", (err) => {
  console.log("❌ Unhandled Rejection:", err.message);
});

process.on("uncaughtException", (err) => {
  console.log("❌ Uncaught Exception:", err.message);
});

// 🚀 Start
startServer();