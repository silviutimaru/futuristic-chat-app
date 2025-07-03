const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Registration route
router.post('/register', [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password min 6 chars'),
  body('firstName').notEmpty().withMessage('First name required'),
  body('lastName').notEmpty().withMessage('Last name required'),
  body('gender').isIn(['male', 'female', 'other']).withMessage('Gender required'),
  body('country').notEmpty().withMessage('Country required'),
  body('language').notEmpty().withMessage('Language required'),
  body('is18OrOlder').equals('true').withMessage('Must confirm 18+')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password, firstName, lastName, gender, country, language } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ errors: [{ msg: 'User already exists' }] });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const activationToken = crypto.randomBytes(32).toString('hex');

    user = new User({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      gender,
      country,
      language,
      is18OrOlder: true,
      activationToken,
      isActive: false
    });

    await user.save();

    // Send activation email
    const activationLink = `${process.env.BASE_URL}/auth/activate/${activationToken}`;

    await transporter.sendMail({
      from: `"Futuristic Chat App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Activate your account',
      html: `
        <h2>Welcome to Futuristic Chat App!</h2>
        <p>Click the link below to activate your account:</p>
        <a href="${activationLink}">${activationLink}</a>
        <p>If you did not register, please ignore this email.</p>
      `
    });

    res.status(201).json({ msg: 'Registration successful. Please check your email to activate your account.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Activation endpoint
router.get('/activate/:token', async (req, res) => {
  try {
    const user = await User.findOne({ activationToken: req.params.token });
    if (!user) {
      return res.status(400).send('Invalid or expired activation token.');
    }
    user.isActive = true;
    user.activationToken = undefined; // Remove the token after activation
    await user.save();
    res.send('Account activated! You can now log in.');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Login route
router.post('/login', [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ errors: [{ msg: 'Invalid credentials' }] });
    }
    if (!user.isActive) {
      return res.status(403).json({ errors: [{ msg: 'Account not activated. Please check your email.' }] });
    }
    if (user.blocked) {
      return res.status(403).json({ errors: [{ msg: 'Account is blocked. Contact support.' }] });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ errors: [{ msg: 'Invalid credentials' }] });
    }

    // You can add JWT token generation here for session management
    res.json({ msg: 'Login successful', user: { email: user.email, firstName: user.firstName, lastName: user.lastName, isAdmin: user.isAdmin } });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Forgot password route
router.post('/forgot-password', [
  body('email').isEmail().withMessage('Valid email required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ errors: [{ msg: 'No account with that email.' }] });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour from now
    console.log('About to save user with reset token:', user);
    await user.save();
    console.log('User saved!');

    const resetLink = `${process.env.BASE_URL}/auth/reset-password/${resetToken}`;

    await transporter.sendMail({
      from: `"Futuristic Chat App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Request',
      html: `
        <h2>Password Reset</h2>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>If you did not request this, please ignore this email.</p>
      `
    });

    res.json({ msg: 'Password reset email sent. Please check your inbox.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Reset password route
router.post('/reset-password/:token', [
  body('password').isLength({ min: 6 }).withMessage('Password min 6 chars')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ errors: [{ msg: 'Invalid or expired token.' }] });
    }

    user.password = await bcrypt.hash(req.body.password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ msg: 'Password has been reset. You can now log in.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;