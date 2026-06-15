const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const { auth } = require("../middleware/auth");
const Resume = require("../models/Resume");
const Interview = require("../models/Interview");
const User = require("../models/User");

router.get("/overview", auth, async (req, res) => {
  try {
    const isConnected = User && mongoose.connection.readyState === 1;
    const isValidUserId = mongoose.Types.ObjectId.isValid(req.user.id);
    const useDb = isConnected && isValidUserId;

    const resumes = useDb ? await Resume.find({ userId: req.user.id }) : [];

    const interviews = useDb
      ? await Interview.find({ userId: req.user.id })
      : [];

    const user = useDb
      ? await User.findById(req.user.id).select("streak scores lastActive xp")
      : null;

    const fallbackScores = user?.scores || req.user?.scores || {};
    const fallbackStreak =
      typeof (user?.streak ?? req.user?.streak) === "number"
        ? (user?.streak ?? req.user.streak)
        : 0;
    const fallbackXp = Number.isFinite(Number(user?.xp ?? req.user?.xp))
      ? Number(user?.xp ?? req.user?.xp)
      : 0;

    const bestResumeScore =
      resumes.length > 0
        ? resumes.reduce((max, resume) => {
            const score = Number(resume.analysis?.resumeScore || 0);
            return Number.isFinite(score) ? Math.max(max, score) : max;
          }, 0)
        : Number.isFinite(Number(fallbackScores.resume))
          ? Number(fallbackScores.resume)
          : 0;

    const interviewScores = interviews
      .map((i) => Number(i.feedback?.overall))
      .filter((score) => Number.isFinite(score));

    const bestInterviewScore =
      interviewScores.length > 0
        ? Math.max(...interviewScores)
        : Number.isFinite(Number(fallbackScores.interview))
          ? Number(fallbackScores.interview)
          : 0;

    const totalInterviews = interviews.length;
    const totalResumes = resumes.length;

    const skillsScore =
      totalResumes > 0 && interviewScores.length > 0
        ? Math.round((bestResumeScore + bestInterviewScore) / 2)
        : totalResumes > 0
          ? bestResumeScore
          : interviewScores.length > 0
            ? bestInterviewScore
            : Number.isFinite(Number(fallbackScores.skills))
              ? Number(fallbackScores.skills)
              : 0;

    const overallScore = (() => {
      const computedOverall = Math.round(
        bestResumeScore * 0.3 + bestInterviewScore * 0.4 + skillsScore * 0.3,
      );
      if (
        totalResumes > 0 ||
        interviewScores.length > 0 ||
        Number.isFinite(Number(fallbackScores.skills))
      ) {
        return Number.isFinite(computedOverall) ? computedOverall : 0;
      }
      return Number.isFinite(Number(fallbackScores.overall))
        ? Number(fallbackScores.overall)
        : 0;
    })();

    const asNumber = (value) =>
      Number.isFinite(Number(value)) ? Number(value) : 0;
    const average = (values) =>
      values.length
        ? Math.round(
            values.reduce((sum, value) => sum + value, 0) / values.length,
          )
        : 0;
    const getUtcDay = (date) => {
      const d = new Date(date);
      if (Number.isNaN(d.getTime())) return null;
      return new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
      );
    };

    const activityEntries = [
      ...resumes.map((resume) => ({
        date: resume.createdAt,
        type: "resume",
        score: asNumber(resume.analysis?.resumeScore),
      })),
      ...interviews.map((interview) => ({
        date: interview.completedAt || interview.createdAt,
        type: "interview",
        score: asNumber(interview.feedback?.overall),
        feedback: interview.feedback || {},
        activityType: interview.type || "Interview",
        difficulty: interview.difficulty || "Unknown",
        duration: interview.duration || 0,
        createdAt: interview.createdAt,
      })),
    ].filter(
      (entry) =>
        entry.date instanceof Date && !Number.isNaN(entry.date.getTime()),
    );

    const currentUtcDate = getUtcDay(new Date());
    const dayOffset = (currentUtcDate.getUTCDay() + 6) % 7;
    const currentWeekStart = new Date(currentUtcDate);
    currentWeekStart.setUTCDate(currentWeekStart.getUTCDate() - dayOffset);
    const firstWeekStart = new Date(
      currentWeekStart.getTime() - 6 * 7 * 24 * 60 * 60 * 1000,
    );

    const trendLabels = Array.from({ length: 7 }, (_, index) =>
      index === 6 ? "This Week" : `${6 - index}w ago`,
    );

    const weekBuckets = Array.from({ length: 7 }, () => ({
      resume: [],
      interview: [],
      skill: [],
    }));

    activityEntries.forEach((entry) => {
      const entryUtc = getUtcDay(entry.date);
      if (!entryUtc) return;
      const weekIndex = Math.floor(
        (entryUtc.getTime() - firstWeekStart.getTime()) /
          (7 * 24 * 60 * 60 * 1000),
      );
      if (weekIndex < 0 || weekIndex >= weekBuckets.length) return;
      if (entry.type === "resume") {
        weekBuckets[weekIndex].resume.push(entry.score);
      } else if (entry.type === "interview") {
        weekBuckets[weekIndex].interview.push(entry.score);
      }
      weekBuckets[weekIndex].skill.push(entry.score);
    });

    const overviewTrend = {
      labels: trendLabels,
      resumeScores: weekBuckets.map((bucket) => average(bucket.resume)),
      interviewScores: weekBuckets.map((bucket) => average(bucket.interview)),
      skillScores: weekBuckets.map((bucket) => average(bucket.skill)),
    };

    const radarValues = {
      technical: average(
        interviews
          .map((i) => asNumber(i.feedback?.technical))
          .filter(Number.isFinite),
      ),
      communication: average(
        interviews
          .map((i) => asNumber(i.feedback?.communication))
          .filter(Number.isFinite),
      ),
      problemSolving: average(
        interviews
          .map((i) => asNumber(i.feedback?.problemSolving))
          .filter(Number.isFinite),
      ),
      confidence: average(
        interviews
          .map((i) => asNumber(i.feedback?.confidence))
          .filter(Number.isFinite),
      ),
    };

    const skillRadar = {
      labels: [
        "Technical",
        "Communication",
        "Problem Solving",
        "Confidence",
        "Leadership",
        "Adaptability",
      ],
      values: [
        radarValues.technical,
        radarValues.communication,
        radarValues.problemSolving,
        radarValues.confidence,
        radarValues.communication || radarValues.technical,
        radarValues.confidence || radarValues.problemSolving,
      ],
    };

    const typeMap = interviews.reduce((acc, interview) => {
      const type = interview.type || "Other";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    const interviewTypeCounts = Object.entries(typeMap).map(
      ([label, value]) => ({
        label,
        value,
      }),
    );

    const scoreBuckets = [0, 0, 0, 0, 0, 0];
    interviewScores.forEach((score) => {
      if (score <= 50) scoreBuckets[0] += 1;
      else if (score <= 60) scoreBuckets[1] += 1;
      else if (score <= 70) scoreBuckets[2] += 1;
      else if (score <= 80) scoreBuckets[3] += 1;
      else if (score <= 90) scoreBuckets[4] += 1;
      else scoreBuckets[5] += 1;
    });
    if (interviewScores.length === 0 && bestInterviewScore > 0) {
      const score = bestInterviewScore;
      if (score <= 50) scoreBuckets[0] += 1;
      else if (score <= 60) scoreBuckets[1] += 1;
      else if (score <= 70) scoreBuckets[2] += 1;
      else if (score <= 80) scoreBuckets[3] += 1;
      else if (score <= 90) scoreBuckets[4] += 1;
      else scoreBuckets[5] += 1;
    }

    const scoreDistribution = {
      labels: ["40-50", "51-60", "61-70", "71-80", "81-90", "91+"],
      values: scoreBuckets,
    };

    const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const weeklyActivity = [0, 0, 0, 0, 0, 0, 0];
    activityEntries.forEach((entry) => {
      const entryUtc = getUtcDay(entry.date);
      if (!entryUtc) return;
      const dayIndex = (entryUtc.getUTCDay() + 6) % 7;
      weeklyActivity[dayIndex] += 1;
    });

    const heatmapStart = new Date(
      currentWeekStart.getTime() -
        13 * 7 * 24 * 60 * 60 * 1000 +
        24 * 60 * 60 * 1000,
    );
    const heatmapCounts = [];
    const heatmapMap = activityEntries.reduce((acc, entry) => {
      const entryUtc = getUtcDay(entry.date);
      if (!entryUtc) return acc;
      const diffDays = Math.floor(
        (entryUtc.getTime() - heatmapStart.getTime()) / (24 * 60 * 60 * 1000),
      );
      if (diffDays < 0 || diffDays >= 91) return acc;
      const key = entryUtc.toISOString().slice(0, 10);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    for (let i = 0; i < 91; i += 1) {
      const day = new Date(heatmapStart.getTime() + i * 24 * 60 * 60 * 1000);
      const key = day.toISOString().slice(0, 10);
      heatmapCounts.push(heatmapMap[key] || 0);
    }

    const recentInterviews = interviews
      .slice()
      .sort(
        (a, b) =>
          new Date(b.completedAt || b.createdAt) -
          new Date(a.completedAt || a.createdAt),
      )
      .slice(0, 6)
      .map((interview) => {
        const completedAt = interview.completedAt || interview.createdAt;
        const durationMinutes = interview.duration
          ? interview.duration
          : interview.completedAt && interview.createdAt
            ? Math.round(
                (new Date(interview.completedAt).getTime() -
                  new Date(interview.createdAt).getTime()) /
                  (60 * 1000),
              )
            : 0;
        return {
          type: interview.type || "Interview",
          difficulty: interview.difficulty || "Unknown",
          score: asNumber(interview.feedback?.overall),
          dur: durationMinutes ? `${durationMinutes} min` : "N/A",
          date: completedAt ? new Date(completedAt).toISOString() : null,
        };
      });

    const activityDates = [
      ...resumes
        .map((resume) => resume.createdAt)
        .filter(
          (date) => date instanceof Date && !Number.isNaN(date.getTime()),
        ),
      ...interviews
        .map((interview) => interview.completedAt || interview.createdAt)
        .filter(
          (date) => date instanceof Date && !Number.isNaN(date.getTime()),
        ),
      ...(user?.lastActive ? [user.lastActive] : []),
    ];

    const activeDays = new Set(
      activityDates
        .map((date) => new Date(date).toISOString().slice(0, 10))
        .filter(Boolean),
    );

    let streakCount = 0;
    let cursor = getUtcDay(new Date());

    while (true) {
      const key = cursor.toISOString().slice(0, 10);
      if (activeDays.has(key)) {
        streakCount += 1;
        cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
        continue;
      }

      const yesterday = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayKey = yesterday.toISOString().slice(0, 10);
      if (streakCount === 0 && activeDays.has(yesterdayKey)) {
        streakCount = 1;
        cursor = new Date(yesterday.getTime() - 24 * 60 * 60 * 1000);
        continue;
      }
      break;
    }

    const streakValue = streakCount > 0 ? streakCount : fallbackStreak;

    res.json({
      bestResumeScore,
      bestInterviewScore,
      skillsScore,
      overallScore,
      xp: fallbackXp,
      totalResumes,
      totalInterviews,
      streak: streakValue,
      overviewTrend,
      skillRadar,
      interviewTypeCounts,
      scoreDistribution,
      weeklyActivity: {
        labels: weekdays,
        counts: weeklyActivity,
      },
      activityHeatmap: heatmapCounts,
      recentInterviews,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;
