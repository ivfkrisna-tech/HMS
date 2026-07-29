require('dotenv').config();
const mongoose = require('mongoose');
const Appointment = require('./src/models/appointment.model');
const Hospital = require('./src/models/hospital.model');

async function migrateAppointments() {
    try {
        await mongoose.connect(process.env.MONGODB_URL);
        console.log('Connected to MongoDB');

        // 1. Find appointments with amount 0 and Paid
        const appointmentsToFix = await Appointment.find({
            amount: 0,
            paymentStatus: { $in: ['Paid', 'paid', 'PAID'] }
        });

        console.log(`Found ${appointmentsToFix.length} appointments to migrate.`);

        let updatedCount = 0;

        for (const appointment of appointmentsToFix) {
            if (appointment.hospitalId) {
                // 2. Fetch the corresponding hospital
                const hospital = await Hospital.findById(appointment.hospitalId).select('appointmentFee');

                // 3. Update the amount with the hospital's default fee (or 300 if not set)
                const defaultFee = (hospital && hospital.appointmentFee) ? Number(hospital.appointmentFee) : 300;

                appointment.amount = defaultFee;
                await appointment.save();
                updatedCount++;
                console.log(`Updated Appointment ${appointment._id} -> New Amount: ${defaultFee}`);
            } else {
                console.log(`Skipped Appointment ${appointment._id} (No hospitalId)`);
            }
        }

        console.log(`\nMigration complete. Successfully updated ${updatedCount} appointments.`);

    } catch (err) {
        console.error('Error during migration:', err);
    } finally {
        mongoose.disconnect();
    }
}

migrateAppointments();
