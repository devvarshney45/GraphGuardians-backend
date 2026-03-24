import dotenv from "dotenv";
dotenv.config(); // ✅ FIX: env load first

import app from "./src/app.js";
import connectDB from "./src/config/db.js";

import http from "http";
import { Server } from "socket.io";
import cors from "cors";

/* =========================
   🌍 GLOBAL CORS (FIX 🔥)
========================= */
app.use(cors({
  origin: true, // ✅ allow all origins
  credentials: true,
}));

/* =========================
   🔥 GLOBAL VARS
========================= */
const PORT = process.env.PORT || 5000;

/* =========================
   🚀 START SERVER FUNCTION
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
       🔥 SOCKET.IO SETUP (FIXED 🔥)
    ========================= */
    const io = new Server(server, {
      cors: {
        origin: "*", // ✅ allow all
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ["websocket", "polling"],
      pingTimeout: 60000,
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
         📦 JOIN ROOM
      ========================= */
      socket.on("joinRepoRoom", (repoId) => {
        if (!repoId) return;

        socket.join(repoId);
        console.log(`📦 Socket ${socket.id} joined room: ${repoId}`);
      });

      /* =========================
         🚪 LEAVE ROOM
      ========================= */
      socket.on("leaveRepoRoom", (repoId) => {
        socket.leave(repoId);
        console.log(`🚪 Socket ${socket.id} left room: ${repoId}`);
      });

      /* =========================
         ❤️ HEARTBEAT
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
       🧪 HEALTH CHECK
    ========================= */
    app.get("/", (req, res) => {
      res.send("🚀 GraphGuard Backend Running");
    });

    /* =========================
       🚀 START SERVER
    ========================= */
    server.listen(PORT, "0.0.0.0", () => {
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
process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err.message);
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err.message);
});

/* =========================
   🚀 START
========================= */
startServer();
