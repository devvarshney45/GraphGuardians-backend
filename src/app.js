import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { connectDB } from "./config/db.js";
import { startCron } from "./jobs/cron.job.js";

// routes
import authRoutes from "./routes/auth.routes.js";
import repoRoutes from "./routes/repo.routes.js";
import analysisRoutes from "./routes/analysis.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import vulnerabilityRoutes from "./routes/vulnerability.routes.js";
import alertRoutes from "./routes/alert.routes.js";
import commitRoutes from "./routes/commit.routes.js";
import githubRoutes from "./routes/github.routes.js";     // ✅ ADD
import graphRoutes from "./routes/graph.routes.js";       // ✅ ADD

import { errorMiddleware } from "./middleware/error.middleware.js";

const app = express();

// 🔐 Security + middleware
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

// 🔗 DB connect
connectDB();

// 🔁 Cron start (AUTO SCAN)
startCron();

// 📦 Routes
app.use("/api/auth", authRoutes);
app.use("/api/repos", repoRoutes);
app.use("/api/analyze", analysisRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/vulnerabilities", vulnerabilityRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/commits", commitRoutes);
app.use("/api/github", githubRoutes);   // ✅ ADD
app.use("/api/graph", graphRoutes);     // ✅ ADD

// ❌ 404 handler
app.use((req, res) => {
  res.status(404).json({ msg: "Route not found" });
});

// 🔥 Global error handler
app.use(errorMiddleware);

export default app;
