import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { connectDB } from "./config/db.js";
import { startCron } from "./jobs/cron.job.js";

// 🔥 Routes
import authRoutes from "./routes/auth.routes.js";
import repoRoutes from "./routes/repo.routes.js";
import analysisRoutes from "./routes/analysis.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import vulnerabilityRoutes from "./routes/vulnerability.routes.js";
import alertRoutes from "./routes/alert.routes.js";
import commitRoutes from "./routes/commit.routes.js";
import githubRoutes from "./routes/github.routes.js";
import graphRoutes from "./routes/graph.routes.js";
import fixRoutes from "./routes/fix.routes.js";
import reportRoutes from "./routes/report.routes.js";
import scanRoutes from "./routes/scan.routes.js"; // ✅ NEW

import { errorMiddleware } from "./middleware/error.middleware.js";

const app = express();

/* =========================
   🔐 GLOBAL MIDDLEWARE
========================= */

app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

/* =========================
   🔗 DB CONNECTION
========================= */

connectDB();

/* =========================
   🔁 CRON JOB (AUTO SCAN)
========================= */

startCron();

/* =========================
   📦 API ROUTES
========================= */

app.use("/api/auth", authRoutes);
app.use("/api/repos", repoRoutes);
app.use("/api/analyze", analysisRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/vulnerabilities", vulnerabilityRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/commits", commitRoutes);
app.use("/api/github", githubRoutes);
app.use("/api/graph", graphRoutes);
app.use("/api/fix", fixRoutes);
app.use("/api/report", reportRoutes);
app.use("/api/scan-history", scanRoutes); // ✅ NEW

/* =========================
   🧪 HEALTH CHECK
========================= */

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    service: "GraphGuard Backend",
    version: "1.0.0",
    time: new Date()
  });
});

/* =========================
   ❌ 404 HANDLER
========================= */

app.use((req, res) => {
  res.status(404).json({
    msg: "Route not found"
  });
});

/* =========================
   🔥 GLOBAL ERROR HANDLER
========================= */

app.use(errorMiddleware);

export default app;
