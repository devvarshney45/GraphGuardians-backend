import dotenv from "dotenv";
dotenv.config();

import app from "./src/app.js";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import { startCron } from "./src/jobs/cron.job.js";

app.use(cors({
  origin: true,
  credentials: true,
}));

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    const server = http.createServer(app);

    const io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ["websocket", "polling"],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    app.set("io", io);

    io.on("connection", (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);

      socket.on("joinRepoRoom", (repoId) => {
        if (!repoId) return;
        socket.join(repoId);
        console.log(`📦 Socket ${socket.id} joined room: ${repoId}`);
      });

      socket.on("leaveRepoRoom", (repoId) => {
        socket.leave(repoId);
        console.log(`🚪 Socket ${socket.id} left room: ${repoId}`);
      });

      socket.on("ping-check", () => {
        socket.emit("pong-check");
      });

      socket.on("disconnect", (reason) => {
        console.log(`❌ Disconnected: ${socket.id} | Reason: ${reason}`);
      });

      socket.on("connect_error", (err) => {
        console.log("❌ Socket error:", err.message);
      });
    });

    app.get("/", (req, res) => {
      res.send("🚀 GraphGuard Backend Running");
    });

    // ✅ startCron INSIDE listen callback
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
      //startCron();
     //console.log("⏰ Cron job started");
    });

  } catch (err) {
    console.error("❌ Server start error:", err.message);
    process.exit(1);
  }
};

process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err.message);
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err.message);
});

startServer();