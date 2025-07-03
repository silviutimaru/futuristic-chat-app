const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

// Middleware to check if the user is admin (for now, use a query param for demo)
function isAdmin(req, res, next) {
  // In production, use JWT or session auth!
  if (req.query.admin === 'true') {
    next();
  } else {
    res.status(403).json({ msg: 'Admin access only' });
  }
}

// View all users
router.get('/users', isAdmin, async (req, res) => {
  const users = await User.find({}, '-password -activationToken -resetPasswordToken -resetPasswordExpires');
  res.json(users);
});

// Block a user
router.post('/block/:id', isAdmin, async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { blocked: true }, { new: true });
  res.json({ msg: 'User blocked', user });
});

// Unblock a user
router.post('/unblock/:id', isAdmin, async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { blocked: false }, { new: true });
  res.json({ msg: 'User unblocked', user });
});

// Delete a user
router.delete('/delete/:id', isAdmin, async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ msg: 'User deleted' });
});

// Resend activation email
router.post('/resend-activation/:id', isAdmin, async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user || user.isActive) {
    return res.status(400).json({ msg: 'User not found or already active' });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const activationLink = `${process.env.BASE_URL}/auth/activate/${user.activationToken}`;
  await transporter.sendMail({
    from: `"Futuristic Chat App" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: 'Activate your account',
    html: `
      <h2>Welcome to Futuristic Chat App!</h2>
      <p>Click the link below to activate your account:</p>
      <a href="${activationLink}">${activationLink}</a>
      <p>If you did not register, please ignore this email.</p>
    `
  });

  res.json({ msg: 'Activation email resent' });
});

// Reset another user's password
router.post('/reset-password/:id', isAdmin, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ msg: 'Password min 6 chars' });
  }
  const hashed = await bcrypt.hash(newPassword, 10);
  await User.findByIdAndUpdate(req.params.id, { password: hashed });
  res.json({ msg: 'Password reset for user' });
});

module.exports = router;