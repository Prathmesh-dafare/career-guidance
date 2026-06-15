const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const Interview = require("../models/Interview");
const User = require("../models/User");

// Temporary in-memory sessions while interview is active
const sessions = new Map();

/**
 * Start Interview
 */
router.post("/start", auth, (req, res) => {
  try {
    const { type, difficulty } = req.body;

    const sessionId = `${req.user.id}_${Date.now()}`;

    sessions.set(sessionId, {
      userId: req.user.id,
      type,
      difficulty,
      messages: [],
      startTime: Date.now(),
    });

    res.json({
      success: true,
      sessionId,
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

/**
 * Save Interview Message
 */
router.post("/message", auth, (req, res) => {
  try {
    const { sessionId, message, role = "user" } = req.body;

    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        error: "Session not found",
      });
    }

    session.messages.push({
      role,
      content: message,
      timestamp: new Date(),
    });

    res.json({
      success: true,
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

/**
 * End Interview & Save To MongoDB
 */
router.post("/end", auth, async (req, res) => {
  try {
    const { sessionId, feedback } = req.body;

    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        error: "Interview session not found",
      });
    }

    session.endTime = Date.now();

    session.duration = Math.round(
      (session.endTime - session.startTime) / 60000,
    );

    const normalizedFeedback = {
      communication: Number(feedback?.communication) || 0,
      technical: Number(feedback?.technical) || 0,
      confidence: Number(feedback?.confidence) || 0,
      problemSolving: Number(feedback?.problemSolving) || 0,
      overall: Number.isFinite(Number(feedback?.overall))
        ? Number(feedback.overall)
        : Math.round(
            (Number(feedback?.communication) || 0) +
              (Number(feedback?.technical) || 0) +
              (Number(feedback?.confidence) || 0) +
              (Number(feedback?.problemSolving) || 0),
          ) / 4,
      strengths: Array.isArray(feedback?.strengths) ? feedback.strengths : [],
      weaknesses: Array.isArray(feedback?.weaknesses)
        ? feedback.weaknesses
        : [],
      suggestions: Array.isArray(feedback?.suggestions)
        ? feedback.suggestions
        : [],
    };

    const interview = await Interview.create({
      userId: req.user.id,
      type: session.type,
      difficulty: session.difficulty,
      messages: session.messages,
      duration: session.duration,
      feedback: normalizedFeedback,
      status: "completed",
      completedAt: new Date(),
    });

    try {
      const user = await User.findById(req.user.id);
      if (user) {
        const currentUtcDay = (date) => {
          const d = new Date(date);
          return new Date(
            Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
          );
        };

        const todayUtc = currentUtcDay(new Date());
        const lastActiveUtc = user.lastActive
          ? currentUtcDay(user.lastActive)
          : null;
        const yesterdayUtc = new Date(todayUtc);
        yesterdayUtc.setUTCDate(yesterdayUtc.getUTCDate() - 1);

        if (!lastActiveUtc || lastActiveUtc.getTime() !== todayUtc.getTime()) {
          const streakContinued =
            lastActiveUtc && lastActiveUtc.getTime() === yesterdayUtc.getTime();
          user.streak = streakContinued ? user.streak + 1 : 1;
          user.lastActive = new Date();
          user.xp = (Number(user.xp) || 0) + 50 + 10;
        } else {
          user.xp = (Number(user.xp) || 0) + 50;
        }
        await user.save();
      }
    } catch (err) {
      console.warn("Failed to award interview XP:", err.message);
    }

    sessions.delete(sessionId);

    res.json({
      success: true,
      interviewId: interview._id,
      duration: session.duration,
    });
  } catch (err) {
    console.error("Interview Save Error:", err);

    res.status(500).json({
      error: err.message,
    });
  }
});

/**
 * Interview History
 */
router.get("/history", auth, async (req, res) => {
  try {
    const interviews = await Interview.find({
      userId: req.user.id,
    }).sort({ createdAt: -1 });

    res.json(interviews);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

/**
 * Dashboard Stats
 */
router.get("/stats", auth, async (req, res) => {
  try {
    const interviews = await Interview.find({
      userId: req.user.id,
    });

    const totalInterviews = interviews.length;

    const totalDuration = interviews.reduce(
      (sum, interview) => sum + (interview.duration || 0),
      0,
    );

    const avgScore =
      interviews.length > 0
        ? Math.round(
            interviews.reduce(
              (sum, interview) => sum + (interview.feedback?.overall || 0),
              0,
            ) / interviews.length,
          )
        : 0;

    res.json({
      totalInterviews,
      totalDuration,
      avgScore,
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

module.exports = router;
