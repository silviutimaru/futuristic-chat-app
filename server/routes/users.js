const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Update user language
router.post('/update-language', async (req, res) => {
  const { userId, language } = req.body;
  if (!userId || !language) {
    return res.status(400).json({ msg: 'Missing userId or language' });
  }
  try {
    await User.findByIdAndUpdate(userId, { language });
    res.json({ msg: 'Language updated' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Default users route (you can keep or remove this)
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});

module.exports = router;