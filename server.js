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
    // 🗄️ DB connect
    await connectDB();
    console.log("✅ MongoDB connected");

    const PORT = process.env.PORT || 5000;

    /* =========================
       🔥 SOCKET SETUP
    ========================= */

    // 👇 create http server
    const server = http.createServer(app);

    // 👇 attach socket
    const io = new Server(server, {
      cors: {
        origin: "*", // production me restrict karna
        methods: ["GET", "POST"],
      },
    });

    // 👇 make io accessible everywhere
    app.set("io", io);

    // 👇 socket connection log
    io.on("connection", (socket) => {
      console.log("🔌 Client connected:", socket.id);

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
