const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fileName: String,
  originalText: String,
  analysis: {
    atsScore: { type: Number, default: 0 },
    resumeScore: { type: Number, default: 0 },
    missingKeywords: [String],
    presentKeywords: [String],
    improvements: [String],
    skills: [String],
    strengths: [String],
    sections: {
      contact: Boolean,
      summary: Boolean,
      experience: Boolean,
      education: Boolean,
      skills: Boolean,
      projects: Boolean
    }
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Resume', resumeSchema);
