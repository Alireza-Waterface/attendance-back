// src/models/Attendance.js
const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const { ATTENDANCE_STATUS } = require('../config/constants');

const attendanceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // تاریخ شمسی: 1403/05/01
  checkIn: { type: Date },
  checkOut: { type: Date },
  status: {
    type: String,
    enum: Object.values(ATTENDANCE_STATUS),
    default: ATTENDANCE_STATUS.PRESENT,
  },
  isJustified: { type: Boolean, default: false },
  justificationNotes: { type: String },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  editHistory: [{
    editor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
    previousState: { type: Object }
  }],
}, { timestamps: true });

// Index for faster queries
attendanceSchema.index({ user: 1, date: 1 }, { unique: true });

attendanceSchema.plugin(mongoosePaginate); 

const Attendance = mongoose.model('Attendance', attendanceSchema);
module.exports = Attendance;