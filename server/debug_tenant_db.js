const mongoose = require('mongoose');
const { getTenantModels } = require('./src/db/tenantModels');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URL);
  
  const Hospital = require('./src/models/hospital.model');
  const hospital = await Hospital.findOne({ _id: '6a3fe94214f09c4aa6e48fa3' });
  if (!hospital) {
    console.log('No hospital found');
    process.exit(0);
  }

  console.log('Hospital DB URI:', hospital.dbURI);
  
  if (hospital.dbURI) {
      const tenantDb = await mongoose.createConnection(hospital.dbURI).asPromise();
      const { Appointment } = getTenantModels(tenantDb);
      
      const tenantAppointments = await Appointment.find({});
      console.log('Appointments in TENANT DB:', tenantAppointments.length);
  } else {
      console.log('Hospital does not have a separate dbURI');
  }
  
  const masterAppointment = require('./src/models/appointment.model');
  const masterAppointments = await masterAppointment.find({ hospitalId: '6a3fe94214f09c4aa6e48fa3' });
  console.log('Appointments in MASTER DB:', masterAppointments.length);

  process.exit(0);
}
run();
