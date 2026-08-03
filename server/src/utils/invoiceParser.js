const pdfParse = require('pdf-parse');

const parseInvoice = async (buffer) => {
    try {
        const data = await pdfParse(buffer);
        const text = data.text;
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        if (lines.length === 0) {
            throw new Error("Unable to read invoice.");
        }

        // Initialize output structure
        const result = {
            invoice: {
                vendorName: "",
                vendorAddress: "",
                invoiceNumber: "",
                invoiceDate: "",
                vendorGST: "",
                vendorDL: "",
                customerName: "",
                customerGST: "",
                grandTotal: 0,
                taxableAmount: 0,
                discount: 0,
                cgst: 0,
                sgst: 0,
                igst: 0,
                purchaseQty: 0,
                freeQty: 0,
                totalMedicines: 0
            },
            medicines: []
        };

        // 1. Extract Header Information
        const gstRegex = /\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/g;
        let gsts = [];
        
        for (let i = 0; i < Math.min(lines.length, 30); i++) {
            const line = lines[i].toLowerCase();
            
            // Vendor Name (heuristic: first line that is not a date or invoice number)
            if (!result.invoice.vendorName && i < 5) {
                const isAddress = /plot|road|street|floor|nagar|marg/i.test(lines[i]);
                const isGST = gstRegex.test(lines[i]);
                const isDate = /(?:date|invoice)/i.test(lines[i]);
                if (!isAddress && !isGST && !isDate && lines[i].length > 3) {
                    result.invoice.vendorName = lines[i];
                } else if (isAddress && !result.invoice.vendorAddress) {
                    result.invoice.vendorAddress = lines[i];
                }
            }

            // Invoice Number
            const invMatch = line.match(/(?:invoice no|inv no|bill no|invoice#)[\s:]*([a-zA-Z0-9\-\/]+)/);
            if (invMatch && !result.invoice.invoiceNumber) {
                result.invoice.invoiceNumber = invMatch[1].toUpperCase();
            } else if (!result.invoice.invoiceNumber && line.match(/^\*?[a-zA-Z0-9]{10,20}\*?$/) && i < 15) {
                // If it's a long alphanumeric string near the top, it's likely the invoice number
                result.invoice.invoiceNumber = line.replace(/\*/g, '').toUpperCase();
            }

            // Invoice Date
            const dateMatch = line.match(/(?:date|invoice date)[\s:]*([\d]{1,2}[\/\-\.][\d]{1,2}[\/\-\.][\d]{2,4})/);
            if (dateMatch && !result.invoice.invoiceDate) {
                result.invoice.invoiceDate = dateMatch[1];
            } else if (!result.invoice.invoiceDate && line.match(/^[\d]{1,2}[\/\-\.][\d]{1,2}[\/\-\.][\d]{2,4}$/)) {
                // Standalone date near top
                result.invoice.invoiceDate = line;
            }

            // GST
            const lineGsts = lines[i].match(gstRegex);
            if (lineGsts) {
                gsts = gsts.concat(lineGsts);
            }

            // DL Number
            const dlMatch = line.match(/(?:dl no|d\.l\. no|dl number|d l no)[\s\.:]*([a-zA-Z0-9\/\-]+)/);
            if (dlMatch && !result.invoice.vendorDL) {
                result.invoice.vendorDL = dlMatch[1].toUpperCase();
            }

            // Heuristic Vendor Address (lines 1 to 3 if not matching invoice number/date)
            if (i > 0 && i < 4 && !invMatch && !dateMatch && !lineGsts && !result.invoice.vendorAddress) {
                result.invoice.vendorAddress += (result.invoice.vendorAddress ? ", " : "") + lines[i];
            }
        }
        
        if (gsts.length > 0) result.invoice.vendorGST = gsts[0];
        if (gsts.length > 1) result.invoice.customerGST = gsts[1];

        // 2. Extract Summary (Footer)
        for (let i = Math.max(0, lines.length - 30); i < lines.length; i++) {
            const line = lines[i].toLowerCase();
            
            const totalMatch = line.match(/(?:grand total|net amount|net total|amount payable)[\s:]*([\d\,\.]+)/);
            if (totalMatch) result.invoice.grandTotal = parseFloat(totalMatch[1].replace(/,/g, ''));
            
            const taxAmtMatch = line.match(/(?:taxable amount|taxable val)[\s:]*([\d\,\.]+)/);
            if (taxAmtMatch) result.invoice.taxableAmount = parseFloat(taxAmtMatch[1].replace(/,/g, ''));

            const cgstMatch = line.match(/cgst[\s:]*([\d\,\.]+)/);
            if (cgstMatch) result.invoice.cgst = parseFloat(cgstMatch[1].replace(/,/g, ''));

            const sgstMatch = line.match(/sgst[\s:]*([\d\,\.]+)/);
            if (sgstMatch) result.invoice.sgst = parseFloat(sgstMatch[1].replace(/,/g, ''));

            const igstMatch = line.match(/igst[\s:]*([\d\,\.]+)/);
            if (igstMatch) result.invoice.igst = parseFloat(igstMatch[1].replace(/,/g, ''));
            
            const discMatch = line.match(/(?:discount|disc)[\s:]*([\d\,\.]+)/);
            if (discMatch) result.invoice.discount = parseFloat(discMatch[1].replace(/,/g, ''));
        }

        // 3. Detect Table Headers Dynamically
        let headerIndex = -1;
        let columnMapping = {};
        
        const headerMappings = {
            medicineName: ['medicine', 'product', 'item description', 'drug', 'description', 'drug name', 'particulars', 'item'],
            batch: ['batch', 'batch no', 'batch number'],
            expiry: ['expiry', 'exp', 'exp date'],
            purchaseQty: ['qty', 'quantity', 'billed', 'purchased'],
            freeQty: ['free', 'free qty', 'scheme', 'sch', 'sch/repl'],
            purchaseRate: ['rate', 'purchase rate', 'ptr'],
            mrp: ['mrp', 'm.r.p'],
            gst: ['gst', 'tax %', 'tax', 'gst %'],
            discount: ['discount', 'disc', 'disc %'],
            amount: ['amount', 'net amount', 'total', 'value']
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].toLowerCase();
            const tokens = line.split(/\s{2,}|\t/).map(t => t.trim()).filter(t => t);
            
            let matchCount = 0;
            let tempMapping = {};

            tokens.forEach((token, index) => {
                const cleanToken = token.replace(/[^a-z0-9 ]/g, '').trim();
                for (const [key, variants] of Object.entries(headerMappings)) {
                    if (variants.includes(cleanToken)) {
                        tempMapping[key] = index;
                        matchCount++;
                        break;
                    }
                }
            });

            // If we found at least 3 matching known columns, we consider this the header row
            if (matchCount >= 3) {
                headerIndex = i;
                columnMapping = tempMapping;
                break;
            }
        }

        if (headerIndex === -1) {
            // FALLBACK PARSER: For PDFs where columns are merged or scattered across lines
            let fallbackMedCount = 0;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                // Pattern 1: Merged numbers with expiry at the end (e.g. 452.00100.006000.0003-28)
                const mergedMatch = line.match(/(\d+\.\d{2})(\d+\.\d{2})(\d+\.\d{2})((?:0[1-9]|1[0-2])[\/\-](?:20\d{2}|\d{2}))$/);
                
                // Pattern 2: Typical standalone Expiry date (MM/YY or MM-YY) on a line by itself or at the end
                const expMatch = line.match(/\b(0[1-9]|1[0-2])[\/\-](20\d{2}|\d{2})\b$/);

                if (mergedMatch) {
                    const mrp = parseFloat(mergedMatch[1]);
                    const purchaseRate = parseFloat(mergedMatch[2]);
                    const expiry = mergedMatch[4];
                    
                    const medicineName = lines[i - 1]?.trim() || 'Unknown';
                    const batchLine = lines[i - 2]?.trim();
                    const batch = (batchLine && !batchLine.includes(' ')) ? batchLine : '';
                    const purchaseQty = parseFloat(lines[i + 1]) || 0;
                    const gst = parseFloat(lines[i + 2]) || 0;

                    result.medicines.push({ medicineName, batch, expiry, purchaseQty, freeQty: 0, purchaseRate, mrp, gst, discount: 0 });
                    fallbackMedCount++;
                } else if (expMatch && !mergedMatch) {
                    // It's a standard scattered block, we try to guess based on surrounding lines
                    // Usually: Name -> Pack -> Batch -> Exp -> Qty -> Rate -> MRP
                    // This is highly heuristic.
                    const expiry = expMatch[0];
                    // Look around for name (usually 2-3 lines above)
                    let medicineName = 'Unknown';
                    let batch = '';
                    let purchaseQty = 0;
                    let purchaseRate = 0;
                    let mrp = 0;

                    for(let j = 1; j <= 4; j++) {
                        if(lines[i-j] && /[a-zA-Z]{3,}/.test(lines[i-j])) {
                            medicineName = lines[i-j].trim();
                            if(lines[i-j+1] && !lines[i-j+1].includes(' ')) batch = lines[i-j+1].trim();
                            break;
                        }
                    }

                    if (lines[i+1]) purchaseQty = parseFloat(lines[i+1].replace(/[^\d\.]/g, '')) || 0;
                    if (lines[i+2]) purchaseRate = parseFloat(lines[i+2].replace(/[^\d\.]/g, '')) || 0;
                    if (lines[i+3]) mrp = parseFloat(lines[i+3].replace(/[^\d\.]/g, '')) || purchaseRate;

                    // Only add if we found a valid name and qty
                    if (medicineName !== 'Unknown' && purchaseQty > 0 && !result.medicines.find(m => m.medicineName === medicineName)) {
                        result.medicines.push({ medicineName, batch, expiry, purchaseQty, freeQty: 0, purchaseRate, mrp, gst: 0, discount: 0 });
                        fallbackMedCount++;
                    }
                }
            }

            if (fallbackMedCount === 0) {
                throw new Error("No medicines detected in this PDF format.");
            }
            
            result.invoice.totalMedicines = fallbackMedCount;
            result.invoice.purchaseQty = result.medicines.reduce((sum, m) => sum + (m.purchaseQty || 0), 0);
            
            return result; // Return early since we used fallback
        }

        // 4. Parse Table Rows
        let totalQty = 0;
        let totalFree = 0;
        let medCount = 0;

        for (let i = headerIndex + 1; i < lines.length; i++) {
            const line = lines[i];
            const lowerLine = line.toLowerCase();
            
            // Stop condition
            if (lowerLine.includes('total') || lowerLine.includes('rupees') || lowerLine.includes('terms') || lowerLine.includes('cgst')) {
                break;
            }

            // Since PDF tables can be unstructured, we split by multiple spaces or single space
            // Often columns merge. We will use a fallback regex heuristic if strict column mapping fails
            const tokens = line.split(/\s+/).map(t => t.trim()).filter(t => t);
            if (tokens.length < 4) continue; // Skip likely invalid lines

            // We attempt to map from right to left because medicine name can contain variable spaces
            const med = {
                medicineName: "",
                batch: "",
                expiry: "",
                purchaseQty: 0,
                freeQty: 0,
                purchaseRate: 0,
                mrp: 0,
                gst: 0,
                discount: 0,
                discountType: "Percentage",
                discountValue: 0,
                amount: 0
            };

            let rightTokens = tokens.reverse();
            let usedTokens = 0;
            
            // Amount is usually last
            med.amount = parseFloat((rightTokens[0] || "0").replace(/[^\d.]/g, '')) || 0;
            usedTokens++;
            
            // Next could be Discount, GST, MRP, Rate, Qty
            // We use heuristics to identify them from the right tokens
            
            let qtyTokenFound = false;
            let expTokenFound = false;
            let batchTokenFound = false;

            for (let j = 1; j < Math.min(rightTokens.length, 8); j++) {
                const token = rightTokens[j];
                
                // Expiry detection MM/YY or MM/YYYY
                if (!expTokenFound && /^(0[1-9]|1[0-2])[\/\-]([2-9][0-9]|20[2-9][0-9])$/.test(token)) {
                    med.expiry = token;
                    expTokenFound = true;
                    usedTokens++;
                    continue;
                }
                
                // Discount detection
                if (token.includes('%')) {
                    med.discountType = "Percentage";
                    med.discountValue = parseFloat(token.replace(/[^0-9.]/g, '')) || 0;
                    usedTokens++;
                    continue;
                } else if (token.startsWith('₹') || token.toLowerCase().startsWith('rs')) {
                    med.discountType = "Flat Amount";
                    med.discountValue = parseFloat(token.replace(/[^0-9.]/g, '')) || 0;
                    usedTokens++;
                    continue;
                }
                
                // Qty/Free detection (e.g., 10, 10+2)
                if (!qtyTokenFound && /^(\d+)(\+(\d+))?$/.test(token)) {
                    const parts = token.split('+');
                    med.purchaseQty = parseInt(parts[0]) || 0;
                    med.freeQty = parseInt(parts[1]) || 0;
                    qtyTokenFound = true;
                    usedTokens++;
                    continue;
                }
            }

            // If we found qty and expiry, the rest to the left is name and batch
            // Let's just use the unparsed tokens from the left as Medicine Name and Batch
            rightTokens.reverse(); // back to normal order
            
            let leftTokens = tokens.slice(0, tokens.length - usedTokens);
            
            if (leftTokens.length > 0) {
                // Heuristic: Batch is usually the last token before Expiry, which means it's the last in leftTokens
                if (expTokenFound && leftTokens.length > 1 && /^[A-Z0-9\-\.]+$/i.test(leftTokens[leftTokens.length - 1])) {
                    med.batch = leftTokens.pop();
                }
                med.medicineName = leftTokens.join(" ");
            }

            // Fallback for missing numeric fields using the column mapping if available
            // but since PDF text order might not align perfectly with header spaces, we just fill zeros
            // unless we can reliably parse them.

            if (med.medicineName && med.medicineName.length > 2) {
                result.medicines.push(med);
                totalQty += med.purchaseQty;
                totalFree += med.freeQty;
                medCount++;
            }
        }

        if (result.medicines.length === 0) {
            throw new Error("No medicines detected.");
        }

        result.invoice.purchaseQty = totalQty;
        result.invoice.freeQty = totalFree;
        result.invoice.totalMedicines = medCount;

        return result;

    } catch (error) {
        if (error.message === "No medicines detected.") {
            throw error;
        }
        throw new Error("Unable to read invoice.");
    }
};

module.exports = { parseInvoice };
