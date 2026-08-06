const lines = [
  'SGST   CGST',
  '1.',
  ' 50',
  '1*25',
  'RL 500ML JEDUX UNIDRIP',
  'FP6050042 4/28300490',
  ' 60.74 19.95',
  ' 0.00 2.50 2.50 997.50',
  '2.',
  ' 48'
];

let rowBuffer = "";
const dataRows = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    console.log(`Checking line: "${line.trim()}" against /^\\d+[\\.\\)]$/`);
    if (/^\d+[\.\)]$/.test(line.trim())) {
        console.log("MATCHED SERIAL NUMBER!");
        if (rowBuffer) dataRows.push(rowBuffer);
        rowBuffer = line;
        continue;
    }

    rowBuffer += (rowBuffer ? "  " : "") + line;
    const hasExpiry = /\b(0?[1-9]|1[0-2])[\/\-](20\d{2}|\d{2})(?!\/|\-)/.test(rowBuffer);
    const decimals = rowBuffer.match(/\d+\.\d{2}/g);
    
    if (hasExpiry && decimals && decimals.length >= 3) {
        if (/\d+\.\d{2}$/.test(line.trim()) && rowBuffer.length > 30) {
            if (decimals.length >= 4) {
                console.log("FLUSHING DUE TO DECIMALS!");
                dataRows.push(rowBuffer);
                rowBuffer = "";
            }
        }
    }
}
if (rowBuffer) dataRows.push(rowBuffer);
console.log("Data Rows Built:");
console.dir(dataRows);
