import app from "./src/app.js";
import dotenv from "dotenv";
import connectDB from "./src/config/db.js";

import http from "http";
import { Server } from "socket.io";

// 🔐 Load env
dotenv.config();

/* =========================
   🔥 GLOBAL VARS
========================= */
const PORT = process.env.PORT || 5000;

/* =========================
   🔥 START SERVER FUNCTION
========================= */
const startServer = async () => {
  try {
    /* =========================
       🗄️ CONNECT DATABASE
    ========================= */
    await connectDB();
    console.log("✅ MongoDB connected");

    /* =========================
       🌐 CREATE HTTP SERVER
    ========================= */
    const server = http.createServer(app);

    /* =========================
       🔥 SOCKET.IO SETUP (PRODUCTION READY)
    ========================= */
    const io = new Server(server, {
      cors: {
        origin: process.env.CLIENT_URL || "*", // 🔥 production me restrict
        methods: ["GET", "POST"],
        credentials: true,
      },

      transports: ["websocket", "polling"], // 🔥 fallback support
      pingTimeout: 60000, // 🔥 prevent disconnects
      pingInterval: 25000,
    });

    /* =========================
       🌍 GLOBAL SOCKET ACCESS
    ========================= */
    app.set("io", io);

    /* =========================
       🔌 SOCKET EVENTS
    ========================= */
    io.on("connection", (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);

      /* =========================
         📦 JOIN ROOM (IMPORTANT)
      ========================= */
      socket.on("joinRepoRoom", (repoId) => {
        if (!repoId) return;

        socket.join(repoId);
        console.log(`📦 Socket ${socket.id} joined room: ${repoId}`);
      });

      /* =========================
         🚪 LEAVE ROOM (OPTIONAL)
      ========================= */
      socket.on("leaveRepoRoom", (repoId) => {
        socket.leave(repoId);
        console.log(`🚪 Socket ${socket.id} left room: ${repoId}`);
      });

      /* =========================
         ❤️ HEARTBEAT (DEBUG)
      ========================= */
      socket.on("ping-check", () => {
        socket.emit("pong-check");
      });

      /* =========================
         ❌ DISCONNECT
      ========================= */
      socket.on("disconnect", (reason) => {
        console.log(`❌ Disconnected: ${socket.id} | Reason: ${reason}`);
      });

      socket.on("connect_error", (err) => {
        console.log("❌ Socket error:", err.message);
      });
    });

    /* =========================
       🚀 START SERVER
    ========================= */
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
    });

  } catch (err) {
    console.error("❌ Server start error:", err.message);
    process.exit(1);
  }
};

/* =========================
   ⚠️ GLOBAL ERROR HANDLING
========================= */

// 🔥 Promise errors
process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err.message);
});

// 🔥 Sync errors
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err.message);
});

// 🚀 Start server
startServer();
