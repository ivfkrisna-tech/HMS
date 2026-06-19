const mongoose = require('mongoose');
require('dotenv').config();

// Define schema for patient inspection
const userSchema = new mongoose.Schema({
    name: String,
    role: String,
    address: String,
    houseNo: String,
    street: String,
    city: String,
    state: String,
    pincode: String,
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);

async function run() {
    console.log("Connecting to Database...");
    if (!process.env.MONGODB_URL) {
        throw new Error("MONGODB_URL is missing in your .env file!");
    }
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("Connected successfully.\n");
    
    console.log("Fetching last 5 registered patients:\n");
    const patients = await User.find({ role: 'patient' })
        .sort({ createdAt: -1 })
        .limit(5);
        
    if (patients.length === 0) {
        console.log("No patients found in the database.");
    } else {
        patients.forEach((patient, index) => {
            console.log(`--- Patient #${index + 1} ---`);
            console.log(`ID:       ${patient._id}`);
            console.log(`Name:     ${patient.name}`);
            console.log(`Address:  ${patient.address}`);
            console.log(`House No: ${patient.houseNo || 'N/A'}`);
            console.log(`Street:   ${patient.street || 'N/A'}`);
            console.log(`City:     ${patient.city || 'N/A'}`);
            console.log(`State:    ${patient.state || 'N/A'}`);
            console.log(`Pincode:  ${patient.pincode || 'N/A'}`);
            console.log('--------------------\n');
        });
    }
    await mongoose.disconnect();
}

run().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
