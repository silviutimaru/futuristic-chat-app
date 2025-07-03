require('dotenv').config();
console.log('MONGODB_URI:', process.env.MONGODB_URI);

const mongoose = require('mongoose');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors'); // <-- Add this line

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const friendsRouter = require('./routes/friends');

const app = express(); // <-- Only create app ONCE

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected!'))
.catch((err) => console.error('MongoDB connection error:', err));

app.use(cors()); // <-- Use CORS BEFORE your routes
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/auth', authRouter);
app.use('/admin', adminRouter);
app.use('/friends', friendsRouter);
// --- General Room Creation (run once at server start) ---
const Room = require('./models/Room');
(async () => {
  try {
    const generalRoom = await Room.findOne({ name: "General Room" });
    if (!generalRoom) {
      await Room.create({ name: "General Room", isPrivate: false, members: [] });
      console.log("General Room created.");
    }
  } catch (err) {
    console.error("Error creating General Room:", err);
  }
})();

module.exports = app;