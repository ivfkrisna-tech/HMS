require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URL = process.env.MONGODB_URL;

if (!MONGODB_URL) {
    console.error('ERROR: MONGODB_URL is not set in your .env file');
    process.exit(1);
}

async function checkDomains() {
    await mongoose.connect(MONGODB_URL);
    console.log('Connected to MongoDB');

    const Hospital = require('../src/models/hospital.model');

    const hospitals = await Hospital.find({}, '_id name customDomain slug');
    console.log('Hospitals in DB:');
    console.log(JSON.stringify(hospitals, null, 2));

    try {
        const indexes = await Hospital.collection.indexes();
        console.log('Indexes on hospitals:');
        console.log(JSON.stringify(indexes, null, 2));
    } catch (err) {
        console.error('Could not fetch indexes:', err.message);
    }

    await mongoose.disconnect();
}

checkDomains().catch(err => {
    console.error('Failed:', err);
    process.exit(1);
});
