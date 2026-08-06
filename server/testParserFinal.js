const line = '1.  50  1*25  RL 500ML JEDUX UNIDRIP  FP6050042 4/28300490  60.74 19.95  0.00 2.50 2.50 997.50';

const med = {
    medicineName: null,
    purchaseQty: null,
    freeQty: 0,
    batchNumber: null,
    expiryDate: null,
    hsn: null,
    pack: null,
    costPrice: null,
    mrp: null,
    discount: null,
    cgst: null,
    sgst: null,
    amount: null
};

let tempLine = line;

// 1. Extract Expiry
const expMatch = tempLine.match(/\b(0?[1-9]|1[0-2])[\/\-](20\d{2}|\d{2})(?!\/|\-)/);
if (expMatch) {
    med.expiryDate = expMatch[0];
    tempLine = tempLine.replace(expMatch[0], ' ');
}

// 2. Extract Prices
const decimals = tempLine.match(/\d+\.\d{2}/g);
if (decimals && decimals.length >= 2) {
    med.mrp = parseFloat(decimals[0]) || 0;
    med.costPrice = parseFloat(decimals[1]) || med.mrp;
    tempLine = tempLine.replace(/\d+\.\d{2}/g, ' ');
}

// 3. Extract Qty (handles optional S.No and optional SGST header remnants)
const qtyMatch = tempLine.match(/^(?:[A-Za-z\s]+)?(?:\d+[\.\)]\s+)?(\d+(?:\+\d+)?)\s/);
if (qtyMatch) {
    const qStr = qtyMatch[1];
    if (qStr.includes('+')) {
        med.purchaseQty = parseInt(qStr.split('+')[0]);
        med.freeQty = parseInt(qStr.split('+')[1]);
    } else {
        med.purchaseQty = parseInt(qStr);
    }
    tempLine = tempLine.substring(qtyMatch[0].length);
}

// 4. Remove Pack details (e.g. 1*25, 1x10)
tempLine = tempLine.replace(/\b\d+[\*xX]\d+\b/i, ' ');

// 5. Extract Medicine Name (everything up to HSN/Batch)
const tokens = tempLine.split(/\s+/).filter(t => t.trim().length > 0);
if (tokens.length > 0) {
    let nameTokens = [];
    for (let t of tokens) {
        if (/^\d{4,}$/.test(t)) break; // Stop at HSN code
        nameTokens.push(t);
    }
    med.medicineName = nameTokens.join(' ').trim();
}

console.log("FINAL MED:", med);
console.log("TEMP LINE AT END:", tempLine);
