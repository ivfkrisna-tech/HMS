const fs = require('fs');
const path = require('path');
const { parseInvoice } = require('./src/utils/invoiceParser');

async function run() {
    try {
        const files = fs.readdirSync(path.join(__dirname, 'uploads/invoices'));
        if (files.length === 0) {
            console.log("No invoices found.");
            return;
        }
        const pdfPath = path.join(__dirname, 'uploads/invoices', files[0]);
        console.log("Testing against:", files[0]);
        const buffer = fs.readFileSync(pdfPath);
        const result = await parseInvoice(buffer);
        console.log(JSON.stringify(result, null, 2));
    } catch (e) {
        console.error(e);
    }
}
run();
