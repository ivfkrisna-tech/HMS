const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");
        const PurchaseInvoice = require('./src/models/PurchaseInvoice');
        await PurchaseInvoice.deleteMany({});
        console.log("Deleted all pending invoices from DB");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
