const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: true
  },
  country: {
    type: String,
    required: true
  },
  language: {
    type: String,
    required: true
  },
  is18OrOlder: {
    type: Boolean,
    required: true
  },
  isActive: {
    type: Boolean,
    default: false
  },
  activationToken: {
    type: String
  },
  friends: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // New: Pending friend invitations (user IDs who sent requests)
  pendingInvitations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // New: Private rooms the user is a member of
  privateRooms: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  blocked: {
    type: Boolean,
    default: false
  },
  resetPasswordToken: {
    type: String
  },
  resetPasswordExpires: {
    type: Date
  }
});

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);