// src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../config/constants');
const mongoosePaginate = require('mongoose-paginate-v2'); 
const { required } = require('joi');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  personnelCode: { type: String, unique: true, sparse: true }, // برای کارکنان اداری و مسئول
  nationalCode: { type: String, unique: true, sparse: true }, // برای هیات علمی
  password: { type: String, required: true, trim: true },
  roles: [{
    type: String,
    enum: Object.values(ROLES),
    required: true,
  }],
  departments: [{
    type: String,
    required: true,
  }],
  roomLocation: { type: String, trim: true },
  avatar: { type: String, default: 'uploads/default-avatar.webp' },
  phoneNumber: { type: String, trim: true },
  profileSettings: {
    isPhoneNumberPublic: { type: Boolean, default: false },
    // سایر تنظیمات حریم خصوصی
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare passwords
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.plugin(mongoosePaginate);

const User = mongoose.model('User', userSchema);
module.exports = User;