const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");

let User;
try {
  User = require("../models/User");
} catch {}

const generateToken = (user) => {
  const payload = {
    id: user._id || user.id,
    email: user.email,
    name: user.name,
  };

  if (user.scores) {
    payload.scores = user.scores;
  }
  if (typeof user.xp === "number") {
    payload.xp = user.xp;
  }
  if (typeof user.streak === "number") {
    payload.streak = user.streak;
  }

  return jwt.sign(payload, process.env.JWT_SECRET || "careerai_secret_key", {
    expiresIn: "7d",
  });
};

// Demo users for when DB is not connected
const demoUsers = new Map();

// Forgot password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    if (User && require("mongoose").connection.readyState === 1) {
      const user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        return res
          .status(404)
          .json({ error: "No account found with that email" });
      }

      const temporaryPassword = `CareerAI-${Math.random()
        .toString(36)
        .slice(-8)}`;
      user.password = temporaryPassword;
      await user.save();

      return res.json({
        message:
          "Temporary password generated. Sign in with it, then change your password from the profile settings.",
        tempPassword: temporaryPassword,
      });
    }

    const stored =
      demoUsers.get(normalizedEmail) ||
      (normalizedEmail === "demo@careerai.com"
        ? {
            id: "demo123",
            name: "Demo User",
            email: normalizedEmail,
            password: "demo123",
          }
        : null);

    if (!stored) {
      return res
        .status(404)
        .json({ error: "No account found with that email" });
    }

    const temporaryPassword = `CareerAI-${Math.random()
      .toString(36)
      .slice(-8)}`;
    stored.password = temporaryPassword;
    demoUsers.set(normalizedEmail, stored);

    return res.json({
      message:
        "Temporary password generated. Sign in with it, then change your password from the profile settings.",
      tempPassword: temporaryPassword,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: "All fields required" });
    if (password.length < 6)
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });

    if (User && require("mongoose").connection.readyState === 1) {
      const existing = await User.findOne({ email });
      if (existing)
        return res.status(400).json({ error: "Email already registered" });
      const user = new User({ name, email, password });
      await user.save();
      const token = generateToken(user);
      return res.json({
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          scores: user.scores,
          xp: user.xp,
          streak: user.streak,
        },
      });
    }

    // Demo mode
    if (demoUsers.has(email))
      return res.status(400).json({ error: "Email already registered" });
    const demoUser = {
      id: Date.now().toString(),
      name,
      email,
      password,
      scores: { resume: 0, interview: 0, skills: 0, overall: 0 },
      xp: 0,
      streak: 0,
      profile: { currentSkills: [], targetRole: "" },
      badges: [],
    };
    demoUsers.set(email, demoUser);
    const token = generateToken(demoUser);
    res.json({
      token,
      user: {
        id: demoUser.id,
        name,
        email,
        scores: demoUser.scores,
        xp: 0,
        streak: 0,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password required" });

    if (User && require("mongoose").connection.readyState === 1) {
      const user = await User.findOne({ email });
      if (!user) return res.status(400).json({ error: "Invalid credentials" });
      const isMatch = await user.comparePassword(password);
      if (!isMatch)
        return res.status(400).json({ error: "Invalid credentials" });
      user.lastActive = new Date();
      await user.save();
      const token = generateToken(user);
      return res.json({
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          scores: user.scores,
          xp: user.xp,
          streak: user.streak,
          badges: user.badges,
        },
      });
    }

    // Demo mode - accept any password for demo@careerai.com
    if (email === "demo@careerai.com") {
      const demoUser = {
        id: "demo123",
        name: "Demo User",
        email,
        scores: { resume: 87, interview: 92, skills: 78, overall: 86 },
        xp: 1250,
        streak: 7,
        badges: [],
      };
      return res.json({ token: generateToken(demoUser), user: demoUser });
    }
    const stored = demoUsers.get(email);
    if (!stored || stored.password !== password)
      return res.status(400).json({ error: "Invalid credentials" });
    const token = generateToken(stored);
    res.json({
      token,
      user: {
        id: stored.id,
        name: stored.name,
        email,
        scores: stored.scores,
        xp: stored.xp,
        streak: stored.streak,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get current user
router.get("/me", require("../middleware/auth").auth, async (req, res) => {
  try {
    if (User && require("mongoose").connection.readyState === 1) {
      const user = await User.findById(req.user.id).select("-password");
      if (!user) return res.status(404).json({ error: "User not found" });
      return res.json(user);
    }
    res.json({ id: req.user.id, name: req.user.name, email: req.user.email });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
