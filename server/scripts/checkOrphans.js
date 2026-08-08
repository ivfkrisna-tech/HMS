require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URL);
        console.log('Connected to Master DB');
        
        const models = {
            User: require('../src/models/user.model'),
            Appointment: require('../src/models/appointment.model'),
            PharmacyOrder: require('../src/models/pharmacyOrder.model'),
            LabReport: require('../src/models/labReport.model'),
            Inventory: require('../src/models/inventory.model'),
            Admission: require('../src/models/admission.model')
        };
        
        for (const [name, model] of Object.entries(models)) {
            let filter = { $or: [{ hospitalId: null }, { hospitalId: { $exists: false } }] };
            if (name === 'User') {
                filter = {
                    $and: [
                        { role: { $nin: ['centraladmin', 'superadmin'] } },
                        filter
                    ]
                };
            }
            const count = await model.countDocuments(filter);
            console.log(`[${name}] Orphans missing hospitalId: ${count}`);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}
run();
