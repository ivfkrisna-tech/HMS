/**
 * One-time script to create the superadmin account.
 * Run: node scripts/createSuperAdmin.js
 * DELETE THIS FILE after running it.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URL = process.env.MONGODB_URL;

if (!MONGODB_URL) {
    console.error('ERROR: MONGODB_URL is not set in your .env file');
    process.exit(1);
}

async function createSuperAdmin() {
    await mongoose.connect(MONGODB_URL);
    console.log('Connected to MongoDB');

    const User = require('../src/models/user.model');

    const email = 'KRISNAIVF@GMAIL.COM'.toLowerCase();
    const password = '12344321';

    const existing = await User.findOne({ email });
    if (existing) {
        console.log('Admin already exists with this email:', email);
        await mongoose.disconnect();
        return;
    }

    const hash = await bcrypt.hash(password, 10);

    await User.create({
        name: 'Krisna IVF Admin',
        email,
        password: hash,
        role: 'centraladmin',
        hospitalId: null
    });

    console.log('');
    console.log('Super admin created successfully!');
    console.log('  Email   :', email);
    console.log('  Password: 12344321');
    console.log('');
    console.log('DELETE this script file now.');

    await mongoose.disconnect();
}

createSuperAdmin().catch(err => {
    console.error('Failed:', err.message);
    process.exit(1);
});
