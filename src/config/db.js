import mongoose from "mongoose";
import { ENV } from "./env.js";

const connectDB = async () => {
  try {
    await mongoose.connect(ENV.MONGO_URI);
    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.log("❌ DB error:", err.message);
    process.exit(1);
  }
};

// ✅ THIS LINE FIXES EVERYTHING
export default connectDB;