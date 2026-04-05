import dotenv from "dotenv";
dotenv.config();

export const ENV = {
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET || "secret",
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  GITHUB_APP_ID: process.env.GITHUB_APP_ID,
  GITHUB_PRIVATE_KEY: process.env.GITHUB_PRIVATE_KEY,
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
  BASE_URL: process.env.BASE_URL || "http://localhost:5000",
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
TIGERGRAPH_HOST: process.env.TIGERGRAPH_HOST,
TIGERGRAPH_GRAPH: process.env.TIGERGRAPH_GRAPH || "dev",
TIGERGRAPH_TOKEN: process.env.TIGERGRAPH_TOKEN,
};
