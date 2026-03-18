export const errorMiddleware = (err, req, res, next) => {
  console.error("🔥 Error:", err);

  // default values
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  // 🧠 Mongoose Validation Error
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map(e => e.message)
      .join(", ");
  }

  // 🧠 Duplicate Key Error
  if (err.code === 11000) {
    statusCode = 400;
    message = "Duplicate field value entered";
  }

  // 🧠 Cast Error (invalid ObjectId)
  if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid ID format";
  }

  res.status(statusCode).json({
    success: false,
    message,
    // 🔥 show stack only in dev
    ...(process.env.NODE_ENV === "development" && { stack: err.stack })
  });
};
