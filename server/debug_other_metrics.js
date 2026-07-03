const mongoose = require('mongoose');
const LabReport = require('./src/models/labReport.model');
const PharmacyOrder = require('./src/models/pharmacyOrder.model');
const Admission = require('./src/models/admission.model');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URL);
  
  const hospitalId = '6a3fe94214f09c4aa6e48fa3';
  
  // 1. Check Lab Reports
  const labs = await LabReport.find({});
  console.log('--- LAB REPORTS ---');
  console.log('Total Lab Reports:', labs.length);
  labs.forEach(l => console.log(`ID: ${l._id}, hospitalId: ${l.hospitalId}, paymentStatus: '${l.paymentStatus}', amount: ${l.amount}`));

  // 2. Check Pharmacy Orders
  const pharm = await PharmacyOrder.find({});
  console.log('\n--- PHARMACY ORDERS ---');
  console.log('Total Pharmacy Orders:', pharm.length);
  pharm.forEach(p => console.log(`ID: ${p._id}, hospitalId: ${p.hospitalId}, paymentStatus: '${p.paymentStatus}', totalAmount: ${p.totalAmount}`));

  // 3. Check Admissions
  const adm = await Admission.find({});
  console.log('\n--- ADMISSIONS ---');
  console.log('Total Admissions:', adm.length);
  adm.forEach(a => console.log(`ID: ${a._id}, hospitalId: ${a.hospitalId}, paymentStatus: '${a.paymentStatus}', totalAmount: ${a.totalAmount}`));

  process.exit(0);
}
run();
