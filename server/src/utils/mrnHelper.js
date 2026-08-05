const Hospital = require('../models/hospital.model');
const User = require('../models/user.model');

/**
 * Extracts and generates a short, readable smart hospital code from a subdomain prefix.
 * Rules:
 * 1. Read the existing hospital subdomain prefix.
 * 2. Generate a short, readable, smart hospital code from the subdomain:
 *    - Must be short and readable.
 *    - Do NOT use the full subdomain.
 *    - Do NOT use fixed logic like first 3 letters only.
 *    - Generate the most meaningful readable code from the subdomain.
 *    - If the subdomain contains a suffix like -1, -2, -3, append it.
 * 
 * @param {string} subdomain - The unique subdomain prefix of the hospital.
 * @returns {string} The smart hospital code.
 */
function generateSmartHospitalCode(subdomain) {
    if (!subdomain) return 'HOSP';

    // 1. Normalize
    const normalized = subdomain.toLowerCase().trim();

    // 2. Extract numeric suffix (e.g. apollohospital-1 -> APHOS1)
    const suffixMatch = normalized.match(/^(.*?)-?(\d+)$/);
    let base = normalized;
    let suffix = '';
    if (suffixMatch) {
        base = suffixMatch[1];
        suffix = suffixMatch[2];
    }

    // Clean up trailing hyphens
    base = base.replace(/-+$/, '');

    // 3. Apply Rules
    // Rule A: Contains hyphen (e.g. kindle-womb -> KIWOM, city-general -> CIGEN)
    if (base.includes('-')) {
        const parts = base.split('-');
        const part1 = parts[0];
        const part2 = parts[1];
        return (part1.slice(0, 2) + part2.slice(0, 3)).toUpperCase() + suffix;
    }

    // Rule B: Ends with a common hospital/clinic/medical suffix (e.g. apollohospital -> APHOS)
    const commonSuffixes = ['hospital', 'clinic', 'medical', 'health', 'care', 'group', 'centre', 'center', 'general'];
    for (const commonSuffix of commonSuffixes) {
        if (base.endsWith(commonSuffix) && base.length > commonSuffix.length) {
            const part1 = base.slice(0, -commonSuffix.length);
            const part2 = commonSuffix;
            return (part1.slice(0, 2) + part2.slice(0, 3)).toUpperCase() + suffix;
        }
    }

    // Rule C: Single word (e.g. apollo -> APLLO)
    return getSmartWordCode(base) + suffix;
}

/**
 * Generates a code for a single word by keeping the first letter and consonants,
 * and filling with vowels up to 5 characters.
 * 
 * @param {string} word - The single word.
 * @returns {string} The 5-letter smart code.
 */
function getSmartWordCode(word) {
    if (word.length <= 5) return word.toUpperCase();
    const firstChar = word[0];
    const rest = word.slice(1);
    const isVowel = c => 'aeiou'.includes(c.toLowerCase());
    const consonants = [...rest].filter(c => !isVowel(c) && /[a-z]/i.test(c));
    let code = firstChar + consonants.join('');
    if (code.length < 5) {
        const vowels = [...rest].filter(c => isVowel(c) || !/[a-z]/i.test(c));
        code += vowels.join('');
    }
    return code.slice(0, 5).toUpperCase();
}

/**
 * Pads the sequence number with leading zeros (e.g. 1 -> 001, 10 -> 010, 100 -> 100).
 * 
 * @param {number} num - The sequence number.
 * @returns {string} The padded sequence string.
 */
function padSequence(num) {
    if (num < 10) return `00${num}`;
    if (num < 100) return `0${num}`;
    return `${num}`;
}

/**
 * Generates the next unique, hospital-specific, sequential MRN.
 * Format: <SMART_HOSPITAL_CODE>-IVF-<SEQUENCE>
 * 
 * @param {string} hospitalId - The ObjectId string of the hospital.
 * @returns {Promise<string>} The generated MRN.
 */
async function generateNextMRN(hospitalId) {
    if (!hospitalId) {
        // Fallback to legacy random MRN if no hospitalId is provided
        return 'MRN-' + Date.now() + Math.floor(Math.random() * 1000);
    }

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
        return 'MRN-' + Date.now() + Math.floor(Math.random() * 1000);
    }

    // Determine subdomain prefix
    let subdomainPrefix = '';
    if (hospital.customDomain) {
        // e.g. apollohospital.krisnaivfgroup5.com -> apollohospital
        subdomainPrefix = hospital.customDomain.split('.')[0];
    } else if (hospital.slug) {
        subdomainPrefix = hospital.slug;
    } else {
        subdomainPrefix = hospital.name;
    }

    // Generate/retrieve the smart hospital code
    const smartCode = generateSmartHospitalCode(subdomainPrefix);

    // Find all patients matching this smart code prefix to compute next sequence
    const pattern = new RegExp(`^${smartCode}-IVF-(\\d+)$`);
    
    // Scoped to the specific hospital
    const patients = await User.find({
        hospitalId: hospital._id,
        patientId: { $regex: '^' + smartCode + '-IVF-\\d+$' }
    }).select('patientId').lean();

    let maxSequence = 0;
    for (const p of patients) {
        const match = p.patientId.match(pattern);
        if (match) {
            const seqNum = parseInt(match[1], 10);
            if (seqNum > maxSequence) {
                maxSequence = seqNum;
            }
        }
    }

    const nextSequence = maxSequence + 1;
    const paddedSequence = padSequence(nextSequence);

    return `${smartCode}-IVF-${paddedSequence}`;
}

async function generateNextCoupleId() {
    const pattern = /^CPL-(\d+)$/;
    const users = await User.find({ coupleId: { $regex: '^CPL-\\d+$' } }).select('coupleId').lean();
    let maxSequence = 0;
    for (const u of users) {
        if (u.coupleId) {
            const match = u.coupleId.match(pattern);
            if (match) {
                const seqNum = parseInt(match[1], 10);
                if (seqNum > maxSequence) {
                    maxSequence = seqNum;
                }
            }
        }
    }
    const nextSequence = maxSequence + 1;
    const paddedSequence = String(nextSequence).padStart(6, '0');
    return `CPL-${paddedSequence}`;
}

module.exports = {
    generateSmartHospitalCode,
    getSmartWordCode,
    padSequence,
    generateNextMRN,
    generateNextCoupleId
};
