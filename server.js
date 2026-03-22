import app from "./src/app.js";
import dotenv from "dotenv";
import connectDB from "./src/config/db.js";

import http from "http";
import { Server } from "socket.io";

// 🔐 Load env
dotenv.config();

/* =========================
   🔥 START SERVER FUNCTION
========================= */
const startServer = async () => {
  try {
    /* =========================
       🗄️ CONNECT DB
    ========================= */
    await connectDB();
    console.log("✅ MongoDB connected");

    const PORT = process.env.PORT || 5000;

    /* =========================
       🔥 CREATE HTTP SERVER
    ========================= */
    const server = http.createServer(app);

    /* =========================
       🔥 SOCKET SETUP (FINAL FIX)
    ========================= */
    const io = new Server(server, {
      cors: {
        origin: "*", // ⚠️ production me specific domain use karna
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ["websocket", "polling"], // 🔥 important fix
      pingTimeout: 60000, // 🔥 prevent timeout
    });

    // 👇 make io globally available
    app.set("io", io);

    /* =========================
       🔌 SOCKET EVENTS
    ========================= */
    io.on("connection", (socket) => {
      console.log("🔌 Client connected:", socket.id);

      // 👇 join room (VERY IMPORTANT 🔥)
      socket.on("joinRepoRoom", (repoId) => {
        socket.join(repoId);
        console.log(`📦 Joined room: ${repoId}`);
      });

      socket.on("disconnect", () => {
        console.log("❌ Client disconnected:", socket.id);
      });
    });

    /* =========================
       🚀 START SERVER
    ========================= */
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error("❌ Server start error:", err.message);
    process.exit(1);
  }
};

/* =========================
   ⚠️ GLOBAL ERROR HANDLING
========================= */

// 🔥 handle promise errors
process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err.message);
});

// 🔥 handle sync errors
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err.message);
});

// 🚀 Start server
startServer();
