const mongoose = require('mongoose');
const dotenv = require('dotenv');
const moment = require('moment-jalaali');

// Load environment variables
dotenv.config();

// Load Mongoose Models
const User = require('./src/models/User');
const Department = require('./src/models/Department');
const Attendance = require('./src/models/Attendance');

// --- Configuration ---
const NUM_OFFICERS = 10;
const NUM_STAFF = 250;
const NUM_FACULTY = 50;
const DAYS_TO_GENERATE = 90; // Generate data for the last 60 days
// --- End Configuration ---


const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected...');
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

// Helper function to get a random element from an array
const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const importData = async () => {
    try {
        console.log('Connecting to DB...');
        await connectDB();
        
        console.log('Clearing existing data (users and attendance)...');
        // Do NOT delete the main admin user (assuming they have a unique identifier)
        await User.deleteMany({ personnelCode: { $ne: '1216287' } }); // Adjust if your admin has a different code
        await Attendance.deleteMany();

        const departments = await Department.find();
        if (departments.length === 0) {
            console.error('No departments found. Please seed departments first.');
            process.exit(1);
        }
        const departmentNames = departments.map(d => d.name);

        const createdUsers = [];

        // --- Create Officers ---
        console.log(`Creating ${NUM_OFFICERS} officers...`);
        for (let i = 1; i <= NUM_OFFICERS; i++) {
            const user = await User.create({
                fullName: `مسئول شماره ${i}`,
                personnelCode: `200${i}`,
                password: 'password123',
                roles: ['کارمند', 'مسئول'],
                departments: [getRandom(departmentNames)],
                isActive: true
            });
            createdUsers.push(user);
        }
        
        // --- Create Staff ---
        console.log(`Creating ${NUM_STAFF} staff members...`);
        for (let i = 1; i <= NUM_STAFF; i++) {
            const user = await User.create({
                fullName: `کارمند شماره ${i}`,
                personnelCode: `300${i}`,
                password: 'password123',
                roles: ['کارمند'],
                departments: [getRandom(departmentNames)],
                isActive: true
            });
            createdUsers.push(user);
        }

        // --- Create Faculty ---
        console.log(`Creating ${NUM_FACULTY} faculty members...`);
        for (let i = 1; i <= NUM_FACULTY; i++) {
            const user = await User.create({
                fullName: `استاد شماره ${i}`,
                nationalCode: `111111111${i.toString().padStart(1, '0')}`,
                password: 'password123',
                roles: ['هیات_علمی'],
                departments: [getRandom(departmentNames)],
                isActive: true
            });
            createdUsers.push(user);
        }

        console.log('All users created successfully.');
        const officers = createdUsers.filter(u => u.roles.includes('مسئول'));
        const employees = createdUsers.filter(u => !u.roles.includes('مسئول'));

        // --- Generate Attendance Records ---
        console.log(`Generating attendance records for the last ${DAYS_TO_GENERATE} days...`);
        const attendanceRecords = [];
        for (let i = 0; i < DAYS_TO_GENERATE; i++) {
            const date = moment().subtract(i, 'days');
            const dateJalali = date.format('jYYYY/jMM/jDD');
            
            // Simulate for each employee
            for (const employee of employees) {
                // ~80% chance of being present
                if (Math.random() < 0.8) {
                    const recorder = getRandom(officers);

                    // Simulate check-in time (e.g., between 7:30 AM and 9:30 AM)
                    const checkIn = date.clone().hour(7).minute(30).add(Math.random() * 120, 'minutes');
                    
                    // ~70% chance of having a checkout record
                    let checkOut = null;
                    if (Math.random() < 0.7) {
                        // Simulate checkout time (e.g., 4 to 8 hours after check-in)
                        checkOut = checkIn.clone().add(4 + Math.random() * 4, 'hours');
                    }
                    
                    // Determine status
                    let status = 'حاضر';
                    // Check only for staff roles for lateness
                    const isStaff = employee.roles.some(r => ['کارمند', 'مدیر'].includes(r));
                    if (isStaff && checkIn.hour() >= 8 && checkIn.minute() > 30) {
                        status = 'تاخیر';
                    }

                    attendanceRecords.push({
                        user: employee._id,
                        date: dateJalali,
                        status: status,
                        isJustified: Math.random() < 0.1, // ~10% chance of being justified
                        recordedBy: recorder._id,
                        checkIn: checkIn.toDate(),
                        checkOut: checkOut ? checkOut.toDate() : null,
                        createdAt: checkIn.toDate(), // Simulate createdAt
                        updatedAt: checkOut ? checkOut.toDate() : checkIn.toDate(),
                    });
                }
            }
        }
        
        await Attendance.insertMany(attendanceRecords);
        console.log(`${attendanceRecords.length} attendance records created successfully.`);

        console.log('Data seeding complete!');
        process.exit();
    } catch (err) {
        console.error(`Error during seeding: ${err}`);
        process.exit(1);
    }
};


// To run the script: node seeder.js
importData();