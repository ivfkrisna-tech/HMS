require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URL = process.env.MONGODB_URL;

if (!MONGODB_URL) {
    console.error('ERROR: MONGODB_URL is not set in your .env file');
    process.exit(1);
}

async function migrate() {
    await mongoose.connect(MONGODB_URL);
    console.log('Connected to MongoDB');

    const Hospital = require('../src/models/hospital.model');

    // 1. Unset customDomain if it is null
    const result = await Hospital.updateMany(
        { customDomain: null },
        { $unset: { customDomain: "" } }
    );
    console.log(`Updated ${result.modifiedCount} hospitals to unset customDomain`);

    // 2. Drop the customDomain_1 index if it exists
    try {
        await Hospital.collection.dropIndex('customDomain_1');
        console.log('Successfully dropped customDomain_1 index');
    } catch (err) {
        if (err.codeName === 'IndexNotFound') {
            console.log('customDomain_1 index did not exist, nothing to drop');
        } else {
            console.error('Error dropping index:', err.message);
        }
    }

    // 3. Recreate the unique sparse index
    console.log('Creating unique sparse index for customDomain...');
    await Hospital.collection.createIndex(
        { customDomain: 1 },
        { unique: true, sparse: true, background: true }
    );
    console.log('Successfully created customDomain_1 index');

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
