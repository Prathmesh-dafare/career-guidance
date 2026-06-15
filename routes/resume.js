const express = require("express");
const router = express.Router();
const multer = require("multer");
const { auth } = require("../middleware/auth");
const Resume = require("../models/Resume");

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only PDF, DOCX, and TXT files allowed"));
  },
});

router.post("/upload", auth, upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    let text = "";
    const { mimetype, buffer, originalname } = req.file;

    if (mimetype === "application/pdf") {
      const pdfParse = require("pdf-parse");
      const data = await pdfParse(buffer);
      text = data.text;
    } else if (mimetype.includes("wordprocessingml")) {
      const mammoth = require("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      text = buffer.toString("utf-8");
    }

    if (!text || text.length < 50) {
      return res.status(400).json({
        error: "Could not extract text from file.",
      });
    }

    console.log("User:", req.user);

    const resume = await Resume.create({
      userId: req.user.id,
      fileName: originalname,
      originalText: text,
      analysis: {
        atsScore: 0,
        resumeScore: 0,
        missingKeywords: [],
        presentKeywords: [],
        improvements: [],
        skills: [],
        strengths: [],
        sections: {
          contact: false,
          summary: false,
          experience: false,
          education: false,
          skills: false,
          projects: false,
        },
      },
    });

    console.log("Resume saved:", resume._id);

    res.json({
      success: true,
      resumeId: resume._id,
      fileName: originalname,
      text: text.slice(0, 5000),
      length: text.length,
    });
  } catch (err) {
    console.error("Resume upload error:", err);
    res.status(500).json({
      error: err.message,
    });
  }
});

module.exports = router;
