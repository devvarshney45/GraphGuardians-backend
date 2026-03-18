import express from "express";
import { connectDB } from "./config/db.js";

import authRoutes from "./routes/auth.routes.js";
import repoRoutes from "./routes/repo.routes.js";
import analysisRoutes from "./routes/analysis.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import vulnerabilityRoutes from "./routes/vulnerability.routes.js";
import alertRoutes from "./routes/alert.routes.js";
import commitRoutes from "./routes/commit.routes.js";

const app = express();
app.use(express.json());

connectDB();

app.use("/api/auth", authRoutes);
app.use("/api/repos", repoRoutes);
app.use("/api/analyze", analysisRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/vulnerabilities", vulnerabilityRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/commits", commitRoutes);

export default app;