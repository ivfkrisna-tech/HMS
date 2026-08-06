const data = [
  '1.  50  1*25  RL 500ML JEDUX UNIDRIP  FP6050042 4/28300490  60.74 19.95  0.00 2.50 2.50 997.50',
  '2.  48  1*24  NS 500ML CLEANPORT  CNSD6208 4/28300490  37.49 17.95  0.00 2.50 2.50 861.60',
  '3.  16  1*4  NS 3000[BIOSYN]  PNIF-6021 3/28300490  550.00 105.00  0.00 2.50 2.50 1680.00',
  '4.  5  1*1  ABDOMINAL SPONGE 30CM*30CM* 16  AS-36 5/2930051090  750.00 195.00  0.00 2.50 2.50 975.00',
  '5.  24  1*24  D5 500ML CLEANPORT  CDAD6019 2/28300490  40.57 18.45  0.00 2.50 2.50 442.80',
  '6.  1  1*1  CIDEX 14-DAY SOLUTION 5LTR  GCA26060 2/2838089400  1313.00 625.00  0.00 9.00 9.00 625.00',
  '7.  10  1*100  SUCTION CATHETER FG 06  G22121059111/2790183990  68.44 8.68  0.00 2.50 2.50 86.80',
  '12.  3  1*1  COTTON WOOL 500GM  C26/01 2/2956012110  516.00 124.50  0.00 2.50 2.50 373.50',
  '17.  5  1*100  FEEDY FG 05[FEEDING TUBE]  G24G011189 6/2990183990  57.19 7.13  0.00 2.50 2.50 35.65',
  '18.  5FEEDY FG 06[FEEDING TUBE]  G26E010319 4/3190183990  68.00 7.13  0.00 2.50 2.50 35.65',
  '19.  5  1*100  FEEDY FG 07  G25K01061810/3090183990  63.00 7.13  0.00 2.50 2.50 35.65',
  '24.  4  1*1  CALLIS PAD  40149010  0.00 260.00  0.00 9.00 9.00 1040.00',
  '25.  12  1*12  VP2347[SYN VICRYL PLUS 1]  T5050 5/3090189099  1015.00 487.20  0.00 2.50 2.50 5846.40'
];

for (const line of data) {
    let tempLine = line;
    const med = { medicineName: null, batch: null, expiry: null, hsn: null };

    // 1. Extract Expiry (no strict \b to allow G22121059111/27)
    // We look for optional non-digit prefix, then Month/Year
    // Wait, if it's G22121059111/27, the month is 11, year is 27.
    // Regex: /(0?[1-9]|1[0-2])[\/\-](20\d{2}|\d{2})(?!\/|\-)/
    // If we just remove \b, it might match 911/27 -> month 11?
    // Let's use: /(?:^|(?<=\D|(?<=\d)))(0?[1-9]|1[0-2])[\/\-](20\d{2}|\d{2})(?!\/|\-)/
    // Actually, just /(0?[1-9]|1[0-2])[\/\-](20\d{2}|\d{2})(?!\/|\-)/ is fine because / is distinct.
    
    // BUT what if there's no space?
    // Ex: G22121059111/2790183990
    // Let's first extract the date:
    const expMatch = tempLine.match(/(0?[1-9]|1[0-2])[\/\-](20\d{2}|\d{2})(?!\/|\-)/);
    if (expMatch) {
        med.expiry = expMatch[0];
        // replace ONLY the exact match so we don't eat surrounding chars
        tempLine = tempLine.replace(expMatch[0], ' ');
    }

    // Now tempLine for row 7 is: G221210591 90183990
    // 5. Extract Medicine Name (everything up to HSN/Batch)
    // Let's strip prices and qty first so we only have name/batch/hsn
    tempLine = tempLine.replace(/\d+\.\d{2}/g, ' '); // prices
    tempLine = tempLine.replace(/^(?:\d+[\.\)]\s+)?(\d+(?:\+\d+)?)[A-Za-z\s]+(FG \d+)?/, ' '); // rough qty skip
    tempLine = tempLine.replace(/\b\d+[\*xX]\d+\b/i, ' '); // packs

    const tokens = tempLine.split(/\s+/).filter(t => t.trim().length > 0);
    if (tokens.length > 0) {
        let nameTokens = [];
        for (let t of tokens) {
            if (/^\d{4,}$/.test(t)) {
                med.hsn = t;
                break; // Stop at HSN code
            }
            nameTokens.push(t);
        }
        
        // The last token in nameTokens is usually the batch number if it has mixed letters/numbers,
        // or if it's explicitly placed before HSN.
        // Let's pop it as batch if it's not a regular word.
        if (nameTokens.length > 1) {
            const last = nameTokens[nameTokens.length - 1];
            // If it has a digit or a dash or a slash, it's highly likely a batch (e.g. AS-36, C26/01, T5050)
            if (/\d|-|\//.test(last) && last !== "ML" && !last.includes("CM")) {
                med.batch = nameTokens.pop();
            } else {
                // sometimes batch has no numbers? rare. 
                // We could just always pop the last token as batch if it's right before HSN/Expiry.
                // But let's stick to alphanumeric heuristic to be safe.
                med.batch = nameTokens.pop(); // Actually, just always pop it! Batch is always last!
            }
        } else if (nameTokens.length === 1 && med.hsn) {
             // If there's only 1 token and we found HSN, that token is probably batch (name was stripped?)
             med.batch = nameTokens.pop();
        }

        med.medicineName = nameTokens.join(' ').trim();
    }
    console.log(med);
}
