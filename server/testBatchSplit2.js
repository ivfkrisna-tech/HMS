const data = [
  '7.  10  1*100  SUCTION CATHETER FG 06  G22121059111/2790183990  68.44 8.68  0.00 2.50 2.50 86.80',
  '12.  3  1*1  COTTON WOOL 500GM  C26/01 2/2956012110  516.00 124.50  0.00 2.50 2.50 373.50'
];

for (const line of data) {
    let tempLine = line;
    const med = { medicineName: null, batch: null, expiry: null, hsn: null };

    // Strict expiry check if it has a word boundary
    let expMatch = tempLine.match(/\b(0?[1-9]|1[0-2])[\/\-](20\d{2}|\d{2})(?!\/|\-)/);
    // If not found, it might be squished into batch or HSN. E.g. G22121059111/2790183990
    // So we look for Month/Year IMMEDIATELY followed by 4+ digits of HSN
    if (!expMatch) {
        expMatch = tempLine.match(/(0?[1-9]|1[0-2])[\/\-](20\d{2}|\d{2})(?=\d{4,})/);
    }

    if (expMatch) {
        med.expiry = expMatch[0];
        tempLine = tempLine.replace(expMatch[0], ' ');
    }

    tempLine = tempLine.replace(/\d+\.\d{2}/g, ' '); // prices
    tempLine = tempLine.replace(/^(?:\d+[\.\)]\s+)?(\d+(?:\+\d+)?)[A-Za-z\s]+(FG \d+)?/, ' '); // rough qty skip
    tempLine = tempLine.replace(/\b\d+[\*xX]\d+\b/i, ' '); // packs

    const tokens = tempLine.split(/\s+/).filter(t => t.trim().length > 0);
    if (tokens.length > 0) {
        let nameTokens = [];
        for (let t of tokens) {
            if (/^\d{4,}$/.test(t)) {
                med.hsn = t;
                break;
            }
            nameTokens.push(t);
        }
        
        if (nameTokens.length > 1) {
            med.batch = nameTokens.pop();
        } else if (nameTokens.length === 1 && med.hsn) {
            med.batch = nameTokens.pop();
        }

        med.medicineName = nameTokens.join(' ').trim();
    }
    console.log(med);
}
