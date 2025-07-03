require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const adminData = {
  email: 'silviotimaru@gmail.com',
  password: 'Bacau@2012',
  firstName: 'Silviu',
  lastName: 'Timaru',
  gender: 'male',
  country: 'Romania',
  language: 'en',
  is18OrOlder: true,
  isActive: true,
  isAdmin: true
};

async function createAdmin() {
  await mongoose.connect(process.env.MONGODB_URI);

  let user = await User.findOne({ email: adminData.email });
  if (user) {
    console.log('Admin user already exists.');
    process.exit();
  }

  adminData.password = await bcrypt.hash(adminData.password, 10);
  user = new User(adminData);
  await user.save();
  console.log('Admin user created!');
  process.exit();
}

createAdmin();