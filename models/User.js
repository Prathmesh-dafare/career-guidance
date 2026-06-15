const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  avatar: { type: String, default: '' },
  role: { type: String, default: 'user' },
  profile: {
    currentSkills: [String],
    targetRole: { type: String, default: '' },
    experience: { type: String, default: 'fresher' },
    bio: { type: String, default: '' }
  },
  scores: {
    resume: { type: Number, default: 0 },
    interview: { type: Number, default: 0 },
    skills: { type: Number, default: 0 },
    overall: { type: Number, default: 0 }
  },
  streak: { type: Number, default: 0 },
  xp: { type: Number, default: 0 },
  lastActive: { type: Date, default: Date.now },
  badges: [{
    id: String,
    name: String,
    icon: String,
    unlockedAt: { type: Date, default: Date.now }
  }],
  bookmarkedQuestions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
  createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.calculateOverallScore = function() {
  this.scores.overall = Math.round(
    this.scores.resume * 0.3 +
    this.scores.interview * 0.4 +
    this.scores.skills * 0.3
  );
};

module.exports = mongoose.model('User', userSchema);
