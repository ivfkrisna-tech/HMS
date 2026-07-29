const mongoose = require('mongoose');
const User = require('./src/models/user.model');
const Appointment = require('./src/models/appointment.model');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URL);
  
  // 1. Fetch some users to see their roles and hospitalIds
  const users = await User.find({}).select('name role _roleData hospitalId').limit(10);
  console.log('Sample Users:');
  users.forEach(u => console.log(u.name, '| role:', u.role, '| hospitalId:', u.hospitalId));

  // 2. Dashboard Query logic on Appointments
  const allPaid = await Appointment.find({ paymentStatus: { $in: ['paid', 'Paid', 'PAID'] } });
  console.log('Total Paid Appointments in Master DB:', allPaid.length);
  if (allPaid.length > 0) {
    const firstPaid = allPaid[0];
    console.log('Sample Paid Appointment hospitalId (raw):', firstPaid.hospitalId);
    console.log('Sample Paid Appointment hospitalId (type):', typeof firstPaid.hospitalId);
  }

  process.exit(0);
}
run();
