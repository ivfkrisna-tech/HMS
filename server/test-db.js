const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const MONGODB_URL = process.env.MONGODB_URL || "mongodb://aryandadheech039_db_user:aryandadheech@ac-xdqn2k1-shard-00-00.croc8ug.mongodb.net:27017,ac-xdqn2k1-shard-00-01.croc8ug.mongodb.net:27017,ac-xdqn2k1-shard-00-02.croc8ug.mongodb.net:27017/Cluster0?ssl=true&replicaSet=atlas-hkiy48-shard-0&authSource=admin&appName=Cluster0";

// Import original schema from model file so we check if the exact model code behaves correctly
const User = require('./src/models/user.model');

async function run() {
    try {
        await mongoose.connect(MONGODB_URL);
        console.log("Connected to DB.");

        const tempEmail = `test_auth_${Date.now()}@gmail.com`;
        const tempPassword = "password123";

        console.log(`Creating test user with email: ${tempEmail}`);
        const user = new User({
            name: "Test Auth User",
            email: tempEmail,
            password: tempPassword,
            role: "hospitaladmin"
        });

        // Trigger pre-save hook and save
        await user.save();
        console.log("Test user saved successfully.");
        console.log(`Saved hash in DB: ${user.password}`);

        // Try direct compare using bcrypt
        const directMatch = await bcrypt.compare(tempPassword, user.password);
        console.log(`Bcrypt direct comparison match: ${directMatch}`);

        // Fetch user from DB and compare using comparePassword method
        const fetched = await User.findOne({ email: tempEmail });
        console.log("Fetched user from DB.");
        const methodMatch = await fetched.comparePassword(tempPassword);
        console.log(`comparePassword method match: ${methodMatch}`);

        // Clean up test user
        await User.deleteOne({ _id: fetched._id });
        console.log("Test user deleted/cleaned up.");

    } catch (err) {
        console.error("Error during authentication test:", err);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected.");
    }
}

run();
