require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
          "https://unpkg.com",
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdnjs.cloudflare.com",
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com",
          "data:",
        ],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: [
          "'self'",
          "https://api.groq.com",
          "https://fonts.googleapis.com",
          "https://fonts.gstatic.com",
        ],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
  }),
);

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later." },
});
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "AI rate limit reached. Please wait." },
});
app.use("/api/", limiter);
app.use("/api/ai", aiLimiter);

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/user", require("./routes/user"));
app.use("/api/ai", require("./routes/ai"));
app.use("/api/resume", require("./routes/resume"));
app.use("/api/interview", require("./routes/interview"));
app.use("/api", require("./routes/analytics"));

// Serve HTML pages
const pages = [
  "",
  "dashboard",
  "interview",
  "resume",
  "roadmap",
  "mentor",
  "analytics",
  "login",
  "register",
];
pages.forEach((page) => {
  const route = page === "" ? "/" : `/${page}`;
  const file = page === "" ? "index" : page;
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, "public", `${file}.html`));
  });
});

// Connect to MongoDB
const connectDB = async () => {
  try {
    if (
      process.env.MONGODB_URI &&
      process.env.MONGODB_URI !==
        "mongodb+srv://username:password@cluster.mongodb.net/careerai"
    ) {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log("✅ MongoDB connected");
    } else {
      console.log("⚠️  MongoDB URI not set - running in demo mode");
    }
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    console.log("Running in demo mode without database");
  }
};

connectDB();
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 CareerAI server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);

  console.log("🔑 GROQ KEY EXISTS:", !!process.env.GROQ_API_KEY);
});
