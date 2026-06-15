const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');

router.get('/profile', auth, async (req, res) => {
  res.json({ id: req.user.id, name: req.user.name, email: req.user.email });
});

router.put('/scores', auth, async (req, res) => {
  res.json({ success: true, ...req.body });
});

module.exports = router;
