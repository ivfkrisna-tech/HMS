// One-time script to seed a supreme (central) admin into the database
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/user.model');

async function seedAdmin() {
    try {
        await mongoose.connect(process.env.MONGODB_URL);
        console.log('✅ Connected to MongoDB');

        const email = 'krisnaivf@gmail.com';
        const existing = await User.findOne({ email });

        if (existing) {
            console.log('⚠️  User with this email already exists:');
            console.log(`   Name: ${existing.name}, Role: ${existing.role}`);
            console.log('   Updating role to centraladmin and resetting password...');
            existing.role = 'centraladmin';
            existing.password = '12344321'; // will be hashed by pre-save hook
            existing.hospitalId = null;
            await existing.save();
            console.log('✅ Updated successfully!');
        } else {
            const admin = new User({
                name: 'Supreme Admin',
                email: email,
                password: '12344321', // will be hashed by pre-save hook
                phone: '',
                role: 'centraladmin',
                hospitalId: null
            });
            await admin.save();
            console.log('✅ Supreme Admin created successfully!');
        }

        console.log(`   Email: ${email}`);
        console.log('   Password: 12344321');
        console.log('   Role: centraladmin');

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

seedAdmin();
