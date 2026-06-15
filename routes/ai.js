const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const Resume = require("../models/Resume");
const User = require("../models/User");

const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

function parseJsonFromRaw(raw) {
  const cleaned = String(raw)
    .replace(/```json|```/g, "")
    .trim();
  const match = cleaned.match(/(\{[\s\S]*\})/);
  const jsonText = match ? match[1] : cleaned;
  return JSON.parse(jsonText);
}

async function callGroq(prompt, systemContext = "") {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY not configured");
  }

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0.8,
    messages: [
      {
        role: "system",
        content: systemContext,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  return completion.choices[0].message.content;
}

// Demo responses when API key not set
const demoResponses = {
  interview: [
    "Great question! Can you explain the difference between synchronous and asynchronous programming? Give me an example of when you'd use each.",
    "Interesting answer! Now, how would you handle error handling in an async/await function?",
    "Good! Let's talk about data structures. How would you implement a queue in JavaScript?",
    "That's a solid answer. Can you explain what closures are and give a practical use case?",
    "Excellent! Finally, how would you optimize the performance of a slow web application?",
  ],
  mentor:
    "I'm here to help with your career journey! Based on your interests, I'd recommend focusing on building practical projects while learning new technologies. Start with small projects and gradually increase complexity. Practice coding daily, even for just 30 minutes. Remember: consistency beats intensity. Would you like specific advice on any particular area?",
  roadmap: `Here's your personalized career roadmap:

**Month 1-2: Foundation**
- Master core concepts in your current skills
- Build 2-3 small projects
- Learn Git & GitHub properly

**Month 3-4: Core Technologies**  
- Deep dive into your target stack
- Complete an online course
- Start contributing to open source

**Month 5: Advanced Concepts**
- System design basics
- Performance optimization
- Testing practices

**Month 6: Job Ready**
- Portfolio polish (3-5 projects)
- Resume optimization
- Interview practice daily
- Apply to 10 jobs/week

You've got this! 🚀`,
};

// AI Chat Mentor
router.post("/mentor", auth, async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    const systemContext = `You are CareerAI, an expert AI career mentor specializing in tech careers, interview preparation, resume building, and skill development. You give concise, actionable, and encouraging advice. Always be specific, practical and motivating. Format responses clearly with bullet points when listing items.`;

    let conversationHistory = history
      .slice(-6)
      .map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content}`)
      .join("\n");
    const prompt = `${conversationHistory}\nUser: ${message}\nAI:`;

    try {
      const response = await callGroq(prompt, systemContext);
      res.json({ response });
    } catch (e) {
      // Demo fallback
      res.json({
        response:
          demoResponses.mentor +
          "\n\n(Note: Connect your Groq API key for personalized AI responses)",
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Interview Question Generator
router.post("/interview/question", auth, async (req, res) => {
  try {
    const { type, difficulty, history = [] } = req.body;
    const systemContext = `You are an expert technical interviewer. Ask ONE interview question at a time. Questions should be for ${type} development at ${difficulty} level. Be conversational and professional. After the first question, react briefly to the user's previous answer, then ask a follow-up question. Keep reactions to 1-2 sentences.`;

    const lastAnswer = history.length > 0 ? history[history.length - 1] : null;
    let prompt =
      history.length === 0
        ? `Start the interview with a warm greeting and your first ${type} interview question.`
        : `The candidate answered: "${lastAnswer?.content}". Give a brief reaction, then ask your next ${type} ${difficulty} question.`;

    try {
      const response = await callGroq(prompt, systemContext);
      res.json({ question: response });
    } catch (e) {
      const idx = Math.min(
        Math.floor(history.length / 2),
        demoResponses.interview.length - 1,
      );
      res.json({
        question:
          demoResponses.interview[idx] +
          "\n\n*(Demo mode - Add Groq API key for real AI)*",
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Interview Feedback Generator
router.post("/interview/feedback", auth, async (req, res) => {
  try {
    const { transcript, type, difficulty } = req.body;
    const systemContext = `You are an expert interview coach. Analyze interview transcripts and provide detailed, constructive feedback. Return ONLY valid JSON, no markdown.`;
    const prompt = `Analyze this ${type} interview (${difficulty} level) transcript and return JSON:
    
Transcript: ${transcript.slice(0, 3000)}

Return this exact JSON structure:
{
  "communication": 75,
  "technical": 80,
  "confidence": 70,
  "problemSolving": 78,
  "overall": 76,
  "strengths": ["strength1", "strength2", "strength3"],
  "weaknesses": ["weakness1", "weakness2"],
  "suggestions": ["suggestion1", "suggestion2", "suggestion3"]
}`;

    try {
      const raw = await callGroq(prompt, systemContext);
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const feedback = JSON.parse(cleaned);
      res.json(feedback);
    } catch (e) {
      res.json({
        communication: 72,
        technical: 78,
        confidence: 68,
        problemSolving: 75,
        overall: 73,
        strengths: [
          "Good problem decomposition",
          "Clear communication",
          "Showed enthusiasm",
        ],
        weaknesses: [
          "Could elaborate more on edge cases",
          "Time complexity analysis needs work",
        ],
        suggestions: [
          "Practice explaining thought process aloud",
          "Study system design patterns",
          "Review data structures daily",
        ],
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Career Roadmap Generator
router.post("/roadmap", auth, async (req, res) => {
  try {
    const { currentSkills, targetRole } = req.body;
    const systemContext = `You are a career development expert. Create detailed, realistic career roadmaps. Return ONLY valid JSON.`;
    const prompt = `Create a 6-month career roadmap. Current skills: ${currentSkills.join(", ")}. Target role: ${targetRole}.

Return this JSON structure:
{
  "title": "Your path to ${targetRole}",
  "summary": "brief overview",
  "months": [
    {
      "month": 1,
      "title": "Month title",
      "focus": "main focus area",
      "tasks": ["task1", "task2", "task3"],
      "milestone": "what you'll achieve"
    }
  ],
  "resources": ["resource1", "resource2"],
  "estimatedTime": "X hours/week"
}`;

    try {
      const raw = await callGroq(prompt, systemContext);
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const roadmap = JSON.parse(cleaned);
      res.json(roadmap);
    } catch (e) {
      res.json({
        title: `Your path to ${targetRole}`,
        summary: "A structured 6-month plan to achieve your career goals",
        months: [
          {
            month: 1,
            title: "Foundation",
            focus: "Core concepts",
            tasks: [
              "Review fundamentals",
              "Set up dev environment",
              "Complete online course",
            ],
            milestone: "Solid foundation established",
          },
          {
            month: 2,
            title: "Core Skills",
            focus: "Primary technologies",
            tasks: [
              "Build first project",
              "Learn frameworks",
              "Practice daily coding",
            ],
            milestone: "First portfolio project",
          },
          {
            month: 3,
            title: "Advanced Concepts",
            focus: "Deep dive",
            tasks: ["Advanced patterns", "Performance optimization", "Testing"],
            milestone: "Advanced project completed",
          },
          {
            month: 4,
            title: "Real Projects",
            focus: "Portfolio building",
            tasks: ["Build 2 projects", "Add to GitHub", "Document work"],
            milestone: "Strong portfolio",
          },
          {
            month: 5,
            title: "Interview Prep",
            focus: "Job preparation",
            tasks: ["Daily LeetCode", "Mock interviews", "System design"],
            milestone: "Interview ready",
          },
          {
            month: 6,
            title: "Job Hunt",
            focus: "Applications",
            tasks: ["Apply to 10/week", "Network actively", "Follow up"],
            milestone: "Land your dream job! 🚀",
          },
        ],
        resources: [
          "freeCodeCamp",
          "The Odin Project",
          "LeetCode",
          "System Design Primer",
        ],
        estimatedTime: "15-20 hours/week",
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Skill Gap Analyzer
router.post("/skillgap", auth, async (req, res) => {
  try {
    const { currentSkills, targetRole } = req.body;
    const systemContext = `You are a technical recruiter and skill assessment expert. Return ONLY valid JSON.`;
    const prompt = `Analyze skill gaps. Current skills: ${currentSkills}. Target role: ${targetRole}.

Return JSON:
{
  "missingSkills": [{"skill": "React", "priority": "high", "timeToLearn": "4-6 weeks"}],
  "presentSkills": ["skill1"],
  "readinessScore": 65,
  "timeline": "4-6 months",
  "learningPath": ["step1", "step2"],
  "resources": [{"name": "resource", "url": "#", "type": "free"}]
}`;

    try {
      const raw = await callGroq(prompt, systemContext);
      const cleaned = raw.replace(/```json|```/g, "").trim();
      res.json(JSON.parse(cleaned));
    } catch (e) {
      res.json({
        missingSkills: [
          { skill: "React.js", priority: "high", timeToLearn: "4-6 weeks" },
          { skill: "Node.js", priority: "high", timeToLearn: "3-4 weeks" },
          { skill: "MongoDB", priority: "medium", timeToLearn: "2-3 weeks" },
        ],
        presentSkills: currentSkills.split(",").map((s) => s.trim()),
        readinessScore: 55,
        timeline: "4-5 months",
        learningPath: [
          "Master JavaScript fundamentals",
          "Learn React",
          "Build backend with Node.js",
          "Add MongoDB",
        ],
        resources: [
          {
            name: "freeCodeCamp",
            url: "https://freecodecamp.org",
            type: "free",
          },
          {
            name: "The Odin Project",
            url: "https://theodinproject.com",
            type: "free",
          },
        ],
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Question Bank Generator
router.post("/questions", auth, async (req, res) => {
  try {
    const { category, difficulty = "intermediate", count = 10 } = req.body;
    const systemContext = `You are an expert technical interviewer. Return ONLY valid JSON array.`;
    const prompt = `Generate ${count} ${category} interview questions at ${difficulty} level.

Return JSON array:
[
  {
    "id": "1",
    "question": "question text",
    "category": "${category}",
    "difficulty": "${difficulty}",
    "answer": "model answer",
    "tags": ["tag1", "tag2"]
  }
]`;

    try {
      const raw = await callGroq(prompt, systemContext);
      const cleaned = raw.replace(/```json|```/g, "").trim();
      res.json(JSON.parse(cleaned));
    } catch (e) {
      // Return demo questions
      const demoQ = [
        {
          id: "1",
          question: `What is the difference between == and === in JavaScript?`,
          category,
          difficulty,
          answer:
            "=== checks both value and type, == only checks value with type coercion.",
          tags: ["javascript", "basics"],
        },
        {
          id: "2",
          question: `Explain the concept of closure in JavaScript.`,
          category,
          difficulty,
          answer:
            "A closure is a function that retains access to its outer scope even after the outer function returns.",
          tags: ["javascript", "advanced"],
        },
        {
          id: "3",
          question: `What is the event loop in JavaScript?`,
          category,
          difficulty,
          answer:
            "The event loop is a mechanism that allows JavaScript to perform non-blocking operations by using callbacks.",
          tags: ["javascript", "async"],
        },
        {
          id: "4",
          question: `Explain Promise.all() vs Promise.race()`,
          category,
          difficulty,
          answer:
            "Promise.all() waits for all promises, Promise.race() resolves when the first promise resolves.",
          tags: ["async", "promises"],
        },
        {
          id: "5",
          question: `What are the differences between let, const, and var?`,
          category,
          difficulty,
          answer:
            "var is function-scoped and hoisted, let and const are block-scoped. const cannot be reassigned.",
          tags: ["javascript", "basics"],
        },
      ];
      res.json(demoQ);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Resume Analysis
router.post("/analyze-resume", auth, async (req, res) => {
  try {
    const { text, resumeId } = req.body;
    const systemContext = `You are an expert ATS resume analyzer and career coach. Return ONLY valid JSON.`;
    const prompt = `Analyze this resume text and return detailed analysis:

Resume: ${text.slice(0, 4000)}

Return JSON:
{
  "atsScore": 78,
  "resumeScore": 82,
  "missingKeywords": ["Docker", "AWS", "TypeScript"],
  "presentKeywords": ["JavaScript", "React", "Node.js"],
  "improvements": ["Add quantified achievements", "Include more keywords"],
  "skills": ["JavaScript", "React"],
  "strengths": ["Clear structure", "Good project descriptions"],
  "sections": {
    "contact": true,
    "summary": false,
    "experience": true,
    "education": true,
    "skills": true,
    "projects": false
  }
}`;

    try {
      const raw = await callGroq(prompt, systemContext);
      const analysis = parseJsonFromRaw(raw);
      console.log("resumeId:", resumeId);
      console.log("analysis:", analysis);

      if (resumeId) {
        const updated = await Resume.findByIdAndUpdate(
          resumeId,
          { $set: { analysis } },
          { new: true, runValidators: true },
        );

        if (!updated) {
          console.warn("Failed to persist resume analysis for", resumeId);
        }
      }

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

          if (
            !lastActiveUtc ||
            lastActiveUtc.getTime() !== todayUtc.getTime()
          ) {
            const streakContinued =
              lastActiveUtc &&
              lastActiveUtc.getTime() === yesterdayUtc.getTime();
            user.streak = streakContinued ? user.streak + 1 : 1;
            user.lastActive = new Date();
            user.xp = (Number(user.xp) || 0) + 30 + 10;
          } else {
            user.xp = (Number(user.xp) || 0) + 30;
          }
          await user.save();
        }
      } catch (xpErr) {
        console.warn("Failed to award resume XP:", xpErr.message);
      }

      res.json(analysis);
    } catch (e) {
      console.error("Analyze error:", e);

      const fallbackAnalysis = {
        atsScore: 72,
        resumeScore: 78,
        missingKeywords: ["Docker", "AWS", "TypeScript", "CI/CD", "Agile"],
        presentKeywords: ["JavaScript", "React", "HTML", "CSS"],
        improvements: [
          "Add a professional summary",
          "Quantify achievements",
          "Include GitHub links",
          "Add more technical keywords",
        ],
        skills: ["JavaScript", "React", "HTML", "CSS", "Git"],
        strengths: ["Clean formatting", "Good education section"],
        sections: {
          contact: true,
          summary: false,
          experience: true,
          education: true,
          skills: true,
          projects: false,
        },
      };

      if (resumeId) {
        const updatedFallback = await Resume.findByIdAndUpdate(
          resumeId,
          { $set: { analysis: fallbackAnalysis } },
          { new: true, runValidators: true },
        );

        if (!updatedFallback) {
          console.warn("Failed to persist fallback analysis for", resumeId);
        }

        console.log("Saved fallback analysis:", resumeId);
      }

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

          if (
            !lastActiveUtc ||
            lastActiveUtc.getTime() !== todayUtc.getTime()
          ) {
            const streakContinued =
              lastActiveUtc &&
              lastActiveUtc.getTime() === yesterdayUtc.getTime();
            user.streak = streakContinued ? user.streak + 1 : 1;
            user.lastActive = new Date();
            user.xp = (Number(user.xp) || 0) + 30 + 10;
          } else {
            user.xp = (Number(user.xp) || 0) + 30;
          }
          await user.save();
        }
      } catch (xpErr) {
        console.warn("Failed to award resume XP:", xpErr.message);
      }

      res.json(fallbackAnalysis);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
