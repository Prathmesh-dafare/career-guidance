const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true },
  difficulty: { type: String, required: true },
  messages: [{
    role: { type: String, enum: ['ai', 'user'] },
    content: String,
    timestamp: { type: Date, default: Date.now }
  }],
  feedback: {
    communication: { type: Number, default: 0 },
    technical: { type: Number, default: 0 },
    confidence: { type: Number, default: 0 },
    problemSolving: { type: Number, default: 0 },
    overall: { type: Number, default: 0 },
    strengths: [String],
    weaknesses: [String],
    suggestions: [String]
  },
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  duration: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  completedAt: Date
});

module.exports = mongoose.model('Interview', interviewSchema);
