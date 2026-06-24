const express = require('express');
const router = express.Router();
const Appointment = require('../models/appointment.model');
const User = require('../models/user.model');
const Doctor = require('../models/doctor.model');
const { verifyToken } = require('../middleware/auth.middleware');
const { resolveTenant } = require('../middleware/tenantMiddleware');
const { getTenantModels } = require('../db/tenantModels');
const { generateNextMRN, generateNextCoupleId } = require('../utils/mrnHelper');

const verifyReceptionOrDoctor = (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const userRole = req.user.role;
    const dynamicRoleName = req.user._roleData?.name;
    const permissions = req.user._roleData?.permissions || [];

    const roleStr = typeof userRole === 'string' ? userRole.toLowerCase() : '';
    const dynRoleStr = dynamicRoleName ? dynamicRoleName.toLowerCase() : '';

    const allowed = ['reception', 'admin', 'superadmin', 'staff', 'front', 'doctor'];
    const hasAccess = allowed.some(keyword => dynRoleStr.includes(keyword) || roleStr.includes(keyword));

    if (hasAccess) {
        return next();
    }

    if (permissions.includes('reception_access') || permissions.includes('*')) {
        return next();
    }

    return res.status(403).json({
        success: false,
        message: `Access denied: Reception or Doctor access only. Your role: ${dynamicRoleName || userRole}`
    });
};

const verifyReception = (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const userRole = req.user.role;
    const dynamicRoleName = req.user._roleData?.name;
    const permissions = req.user._roleData?.permissions || [];

    const roleStr = typeof userRole === 'string' ? userRole.toLowerCase() : '';
    const dynRoleStr = dynamicRoleName ? dynamicRoleName.toLowerCase() : '';

    const allowed = ['reception', 'admin', 'superadmin', 'staff', 'front'];
    const hasAccess = allowed.some(keyword => dynRoleStr.includes(keyword) || roleStr.includes(keyword));

    if (hasAccess) {
        return next();
    }

    if (permissions.includes('reception_access') || permissions.includes('*')) {
        return next();
    }

    return res.status(403).json({
        success: false,
        message: `Access denied: Reception access only. Your role: ${dynamicRoleName || userRole}`
    });
};

// 1. REGISTER (WALK-IN)
router.post('/register', verifyToken, verifyReception, async (req, res) => {
    try {
        let { name, email, phone, linkedPatientId, relationLabel } = req.body;

        name = name ? String(name).trim() : undefined;
        phone = phone ? String(phone).trim() : undefined;
        email = email ? String(email).trim() : undefined;

        if (!name || !phone) {
            return res.status(400).json({ success: false, message: 'Name and Phone are required' });
        }

        const orClauses = [{ phone }];
        if (email) orClauses.push({ email });

        let userQuery = { $or: orClauses };
        if (req.user.hospitalId) {
            userQuery.hospitalId = req.user.hospitalId;
        }

        let user = await User.findOne(userQuery);

        if (user) {
            user.name = name;
            if (email && email !== user.email) user.email = email;

            if (!user.patientId) {
                const nextMrn = await generateNextMRN(req.user.hospitalId);
                user.patientId = nextMrn;
                user.mrn = nextMrn;
            }

            await user.save();

            // Apply symmetric link if requested
            if (linkedPatientId) {
                await _applySymmetricLink(String(user._id), String(linkedPatientId), relationLabel || 'Related');
                const partner = await User.findById(linkedPatientId);
                if (partner) {
                    user.houseNumber = partner.houseNumber;
                    user.street = partner.street;
                    user.address = partner.address;
                    user.city = partner.city;
                    user.state = partner.state;
                    user.pincode = partner.pincode;
                    user.sourceInformation = partner.sourceInformation;
                    await user.save();
                }
            }

            return res.status(200).json({ success: true, message: 'Patient record updated!', user });
        }

        const patientId = await generateNextMRN(req.user.hospitalId);

        const userData = {
            name,
            phone,
            role: 'patient',
            patientId,
            mrn: patientId,
            fertilityProfile: {},
            hospitalId: req.user.hospitalId || undefined
        };

        if (email) userData.email = email;

        const newUser = new User(userData);
        await newUser.save();

        // Apply symmetric link if requested
        if (linkedPatientId) {
            await _applySymmetricLink(String(newUser._id), String(linkedPatientId), relationLabel || 'Related');
            const partner = await User.findById(linkedPatientId);
            if (partner) {
                newUser.houseNumber = partner.houseNumber;
                newUser.street = partner.street;
                newUser.address = partner.address;
                newUser.city = partner.city;
                newUser.state = partner.state;
                newUser.pincode = partner.pincode;
                newUser.sourceInformation = partner.sourceInformation;
                await newUser.save();
            }
        }

        res.status(201).json({ success: true, message: 'Patient registered successfully!', user: newUser });
    } catch (error) {
        console.error("Register Error:", error);
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern || {})[0] || 'field';
            const friendlyField = field === 'phone' ? 'Phone number'
                : field === 'email' ? 'Email'
                    : field === 'patientId' ? 'Patient ID'
                        : field;
            return res.status(400).json({
                success: false,
                message: `A patient with this ${friendlyField} already exists. Please search for the existing patient instead.`
            });
        }
        res.status(500).json({ success: false, message: error.message });
    }
});

// 1.5 AADHAAR VERIFICATION (OTP FLOW - SIMULATED)
router.post('/send-aadhaar-otp', verifyToken, verifyReception, async (req, res) => {
    try {
        const { aadhaarNumber } = req.body;
        if (!/^\d{12}$/.test(aadhaarNumber)) return res.status(400).json({ success: false, message: 'Invalid Aadhaar Format (12 digits required)' });

        if (aadhaarNumber.startsWith('9999')) return res.status(400).json({ success: false, message: 'Verification Failed: Invalid Aadhaar Number (Simulated).' });

        await new Promise(resolve => setTimeout(resolve, 1000));
        res.json({ success: true, message: 'OTP sent to mobile linked with Aadhaar (Simulated: Use 123456)' });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/verify-aadhaar-otp', verifyToken, verifyReception, async (req, res) => {
    try {
        const { aadhaarNumber, otp } = req.body;

        if (otp !== '123456') {
            return res.status(400).json({ success: false, message: 'Invalid OTP. Try 123456.' });
        }

        const existingUser = await User.findOne({ aadhaarNumber });
        if (existingUser) {
            return res.status(409).json({ success: false, message: `Aadhaar already linked to patient: ${existingUser.name} (${existingUser.phone})` });
        }

        const mockKYCData = {
            verified: true,
            fullName: "Simulated Aadhaar User",
            dob: "1995-05-20",
            gender: "Female",
            address: "42, Simulated Residency, Connaught Place, New Delhi - 110001",
            photo: "https://via.placeholder.com/150"
        };

        res.json({ success: true, message: 'Aadhaar Verified Successfully', data: mockKYCData });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: e.message });
    }
});

// 2. SEARCH
router.get('/search-patients', verifyToken, verifyReception, async (req, res) => {
    try {
        const { query } = req.query;
        if (!query || query.length < 2) return res.json({ success: true, patients: [] });

        const queryFilter = {
            role: { $in: ['user', 'patient'] },
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { phone: { $regex: query, $options: 'i' } },
                { patientId: { $regex: query, $options: 'i' } },
                { 'fertilityProfile.partnerFirstName': { $regex: query, $options: 'i' } },
                { 'fertilityProfile.partnerLastName': { $regex: query, $options: 'i' } }
            ]
        };

        if (req.user.hospitalId) {
            queryFilter.hospitalId = req.user.hospitalId;
        }

        const patients = await User.find(queryFilter)
            .select('name phone email patientId avatar houseNumber street address city state pincode sourceInformation fertilityProfile partnerPatientId partnerRelation coupleId')
            .populate({
                path: 'partnerPatientId',
                select: 'name phone patientId coupleId'
            })
            .lean();
        res.json({ success: true, patients });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// ─── HELPER: Symmetric Link ──────────────────────────────────────────────────
/**
 * Creates a bidirectional link between two patients.
 * Safe to call multiple times — skips if the link already exists.
 * @param {string} idA - MongoDB ObjectId string of patient A
 * @param {string} idB - MongoDB ObjectId string of patient B
 * @param {string} label - Relation label (e.g. 'Husband', 'Wife')
 */
async function _applySymmetricLink(idA, idB, label) {
    if (!idA || !idB || idA === idB) return;
    const labelAB = label || 'Related';
    // Reverse label map for the opposite direction
    const reverseMap = {
        Husband: 'Wife', Wife: 'Husband',
        Father: 'Child', Mother: 'Child', Son: 'Parent', Daughter: 'Parent',
        Brother: 'Sibling', Sister: 'Sibling', Sibling: 'Sibling',
        Child: 'Parent', Parent: 'Child', Partner: 'Partner',
    };
    const labelBA = reverseMap[labelAB] || labelAB;

    const [userA, userB] = await Promise.all([
        User.findById(idA),
        User.findById(idB)
    ]);
    if (!userA || !userB) return;

    let targetCoupleId = userA.coupleId || userB.coupleId;
    if (!targetCoupleId) {
        targetCoupleId = await generateNextCoupleId();
    }

    await User.findByIdAndUpdate(idA, { $pull: { linkedPatients: { patientId: idB } } });
    await User.findByIdAndUpdate(idA, {
        coupleId: targetCoupleId,
        $push: { linkedPatients: { patientId: idB, relationLabel: labelAB } },
        ...((['Husband', 'Wife', 'Partner'].includes(labelAB)) ? { partnerPatientId: idB, partnerRelation: labelAB } : {})
    });
    
    await User.findByIdAndUpdate(idB, { $pull: { linkedPatients: { patientId: idA } } });
    await User.findByIdAndUpdate(idB, {
        coupleId: targetCoupleId,
        $push: { linkedPatients: { patientId: idA, relationLabel: labelBA } },
        ...((['Husband', 'Wife', 'Partner'].includes(labelBA)) ? { partnerPatientId: idA, partnerRelation: labelBA } : {})
    });
}

// 3. UPDATE INTAKE
router.put('/intake/:userId', verifyToken, verifyReceptionOrDoctor, async (req, res) => {
    try {
        const { userId } = req.params;
        const updates = req.body;

        // Inherit Address & Source Information if patient has a partner/linked patient
        let partnerId = updates.linkedPatientId || updates.partnerPatientId;
        if (!partnerId) {
            const currentPatientObj = await User.findById(userId);
            if (currentPatientObj) {
                partnerId = currentPatientObj.partnerPatientId;
            }
        }
        if (partnerId) {
            const partner = await User.findById(partnerId);
            if (partner) {
                updates.houseNumber = partner.houseNumber;
                updates.street = partner.street;
                updates.address = partner.address;
                updates.city = partner.city;
                updates.state = partner.state;
                updates.pincode = partner.pincode;
                updates.sourceInformation = partner.sourceInformation;
                if (partner.marriageDate) {
                    updates.marriageDate = partner.marriageDate;
                } else if (partner.fertilityProfile && partner.fertilityProfile.marriageDate) {
                    updates.marriageDate = partner.fertilityProfile.marriageDate;
                }
            }
        }

        const updateQuery = {};

        if (updates.firstName || updates.lastName) updateQuery.name = `${updates.firstName || ''} ${updates.lastName || ''}`.trim();
        if (updates.email) updateQuery.email = updates.email;
        if (updates.phone || updates.mobile) updateQuery.phone = updates.phone || updates.mobile;
        if (updates.address) updateQuery.address = updates.address;
        if (updates.houseNumber !== undefined) updateQuery.houseNumber = updates.houseNumber;
        if (updates.street !== undefined) updateQuery.street = updates.street;
        if (updates.city !== undefined) updateQuery.city = updates.city;
        if (updates.state !== undefined) updateQuery.state = updates.state;
        if (updates.pincode !== undefined) updateQuery.pincode = updates.pincode;
        if (updates.zipCode !== undefined) updateQuery.zipCode = updates.zipCode;

        if (updates.aadhaar) updateQuery.aadhaarNumber = updates.aadhaar;
        if (updates.isAadhaarVerified !== undefined) updateQuery.isAadhaarVerified = updates.isAadhaarVerified;
        if (updates.avatar) updateQuery.avatar = updates.avatar;
        if (updates.consents) updateQuery.consents = updates.consents;
        if (updates.sourceInformation !== undefined) updateQuery.sourceInformation = updates.sourceInformation;
        if (updates.linkedAppointmentId !== undefined) updateQuery.linkedAppointmentId = updates.linkedAppointmentId;
        if (updates.marriageDate !== undefined) updateQuery.marriageDate = updates.marriageDate;

        const profileFields = [
            'title', 'firstName', 'middleName', 'lastName', 'dob', 'marriageDate', 'age', 'gender', 'maritalStatus', 'occupation',
            'aadhaar', 'altPhone', 'patientCategory', 'nationality', 'isInternational', 'language', 'languagesKnown',
            'height', 'weight', 'bmi', 'bloodGroup',
            'partnerTitle', 'partnerFirstName', 'partnerLastName', 'partnerDob', 'partnerAge', 'partnerAadhaar',
            'partnerRelation', 'partnerMobile', 'partnerAltPhone', 'partnerEmail', 'partnerAddressSame', 'partnerAddress',
            'partnerArea', 'partnerCity', 'partnerState', 'partnerCountry', 'partnerPinCode', 'partnerNationality',
            'partnerHeight', 'partnerWeight', 'partnerBmi', 'partnerBloodGroup',
            'reasonForVisit', 'speciality', 'doctor', 'referralType', 'visitDate', 'visitTime',
            'infertilityType', 'chiefComplaint', 'historyPulse', 'historyBp', 'infertilityDuration', 'marriageDuration', 'generalComments',
            'lmpDate', 'menstrualRegularity', 'menstrualFlow', 'menstrualPain', 'cycleDetails',
            'familyHistory', 'medicalHistoryDiabetes', 'medicalHistoryHypertension', 'medicalHistoryThyroid',
            'medicalHistoryHeart', 'medicalHistoryAsthma', 'medicalHistoryTb', 'medicalHistoryOther', 'medicalHistoryPcos',
            'para', 'abortion', 'ectopic', 'liveBirth', 'recurrentLoss', 'obstetricComments',
            'pastInvestigations', 'partnerBp', 'partnerMedicalComments',
            'labResults', 'hormonalValues', 'usgRemarks', 'psychiatricHistory', 'sexualHistory', 'identificationMarks', 'addictionHistory',
            'treatmentHistory',
            'examGeneral', 'examSystemic', 'examBreast', 'examAbdomen', 'examSpeculum', 'examVaginal',
            'hirsutism', 'galactorrhoea', 'papSmear',
            'usgType', 'afcRight', 'afcLeft', 'amh', 'uterusSize', 'uterusPosition',
            'ovaryRightSize', 'ovaryLeftSize', 'endometriumThickness',
            'diagnosisInfertilityType', 'maleFactor', 'femaleFactor', 'diagnosisYears', 'diagnosisOthers',
            'doctorNotes', 'prescriptionComments', 'procedureAdvice', 'followUpDate', 'transactionId'
        ];

        profileFields.forEach(field => {
            if (updates[field] !== undefined) {
                updateQuery[`fertilityProfile.${field}`] = updates[field];
            }
        });

        const updatedUser = await User.findByIdAndUpdate(userId, { $set: updateQuery }, { new: true, runValidators: false });
        if (!updatedUser) return res.status(404).json({ success: false, message: 'Patient not found' });

        // Apply symmetric link if a linkedPatientId is supplied during intake update
        if (updates.linkedPatientId) {
            await _applySymmetricLink(userId, String(updates.linkedPatientId), updates.relationLabel || 'Related');
        }

        res.json({ success: true, message: 'Updated', user: updatedUser });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// ─── LINK PATIENTS (POST) ─────────────────────────────────────────────────────
// Links two existing patients bidirectionally.
// Body: { patientId, linkedPatientId, relationLabel }
router.post('/link-patients', verifyToken, verifyReception, async (req, res) => {
    try {
        const { patientId, linkedPatientId, relationLabel } = req.body;
        if (!patientId || !linkedPatientId) {
            return res.status(400).json({ success: false, message: 'patientId and linkedPatientId are required' });
        }
        if (String(patientId) === String(linkedPatientId)) {
            return res.status(400).json({ success: false, message: 'A patient cannot be linked to themselves' });
        }
        const [pA, pB] = await Promise.all([
            User.findById(patientId),
            User.findById(linkedPatientId),
        ]);
        if (!pA) return res.status(404).json({ success: false, message: 'Patient not found' });
        if (!pB) return res.status(404).json({ success: false, message: 'Linked patient not found' });

        await _applySymmetricLink(String(pA._id), String(pB._id), relationLabel || 'Related');
        res.json({ success: true, message: `${pA.name} and ${pB.name} are now linked.` });
    } catch (error) {
        console.error('Link patients error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ─── UNLINK PATIENTS (DELETE) ─────────────────────────────────────────────────
// Removes the bidirectional link between two patients.
// Params: :patientId, :linkedId
router.delete('/link-patients/:patientId/:linkedId', verifyToken, verifyReception, async (req, res) => {
    try {
        const { patientId, linkedId } = req.params;
        await User.findByIdAndUpdate(patientId, {
            $pull: { linkedPatients: { patientId: linkedId } }
        });
        await User.findByIdAndUpdate(linkedId, {
            $pull: { linkedPatients: { patientId: patientId } }
        });

        // Unset partner fields if they were linked as partner
        const patient = await User.findById(patientId);
        if (patient && String(patient.partnerPatientId) === String(linkedId)) {
            patient.partnerPatientId = null;
            patient.partnerRelation = null;
            patient.linkedAppointmentId = null;
            await patient.save();
        }
        const linked = await User.findById(linkedId);
        if (linked && String(linked.partnerPatientId) === String(patientId)) {
            linked.partnerPatientId = null;
            linked.partnerRelation = null;
            linked.linkedAppointmentId = null;
            await linked.save();
        }

        res.json({ success: true, message: 'Patients unlinked successfully.' });
    } catch (error) {
        console.error('Unlink patients error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ─── LINKED RECORDS (GET) ─────────────────────────────────────────────────────
// Returns the merged appointment + lab + pharmacy + visit records for a patient
// AND all of their linked patients, labeled with patient name.
router.get('/linked-records/:patientId', verifyToken, verifyReception, async (req, res) => {
    try {
        const { patientId } = req.params;
        const patient = await User.findById(patientId)
            .populate('linkedPatients.patientId', 'name phone patientId linkedAppointmentId')
            .lean();

        if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

        const hFilter = req.user.hospitalId ? { hospitalId: req.user.hospitalId } : {};
        const LabReport = require('../models/labReport.model');
        const PharmacyOrder = require('../models/pharmacyOrder.model');
        const ClinicalVisit = require('../models/clinicalVisit.model');

        // Gather all subject IDs: this patient + all linked patients
        const subjects = [
            { id: patient._id, patientIdStr: patient.patientId, name: patient.name, linkedAppointmentId: patient.linkedAppointmentId },
            ...(patient.linkedPatients || []).map(lp => ({
                id: lp.patientId?._id || lp.patientId,
                patientIdStr: lp.patientId?.patientId || '',
                name: lp.patientId?.name || 'Linked Patient',
                relationLabel: lp.relationLabel,
                linkedAppointmentId: lp.patientId?.linkedAppointmentId
            }))
        ];

        const allRecords = await Promise.all(subjects.map(async (subj) => {
            const subjId = subj.id;
            const subjPidStr = subj.patientIdStr;
            const apptOrClauses = [{ userId: subjId }, { patientId: subjPidStr }];
            if (subj.linkedAppointmentId) {
                apptOrClauses.push({ _id: subj.linkedAppointmentId });
            }
            const [appointments, labs, pharmacy, visits] = await Promise.all([
                Appointment.find({ $or: apptOrClauses, ...hFilter })
                    .populate('doctorId', 'name').sort({ appointmentDate: -1 }).limit(50).lean(),
                LabReport.find({ $or: [{ userId: subjId }, { patientId: subjId }], ...hFilter })
                    .sort({ createdAt: -1 }).limit(30).lean(),
                PharmacyOrder.find({ $or: [{ userId: subjId }, { patientId: subjId }], ...hFilter })
                    .sort({ createdAt: -1 }).limit(30).lean(),
                ClinicalVisit.find({ patientId: subjId, ...hFilter })
                    .sort({ createdAt: -1 }).limit(30).lean(),
            ]);
            return { patient: subj, appointments, labs, pharmacy, visits };
        }));

        res.json({ success: true, subjects: allRecords });
    } catch (error) {
        console.error('Linked records error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ─── GET LINKED PATIENTS (GET) ─────────────────────────────────────────────────
// Returns a patient's linked patients with their basic info.
router.get('/linked-patients/:patientId', verifyToken, verifyReception, async (req, res) => {
    try {
        const patient = await User.findById(req.params.patientId)
            .populate('linkedPatients.patientId', 'name phone patientId email avatar fertilityProfile')
            .lean();
        if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });
        res.json({ success: true, linkedPatients: patient.linkedPatients || [] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 4. APPOINTMENTS (Range Window Safe Query Fix for Active Queue Visibility)
router.get('/appointments', verifyToken, verifyReception, resolveTenant, async (req, res) => {
    try {
        let queryFilter = {};
        if (req.user.hospitalId) queryFilter.hospitalId = req.user.hospitalId;

        if (req.query.all !== 'true') {
            queryFilter.status = { $nin: ['cancelled', 'completed'] };
            
            // Re-instantiated clean date objects directly to prevent native int mutation values from being passed to Mongoose
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);

            const endOfToday = new Date();
            endOfToday.setHours(23, 59, 59, 999);

            queryFilter.appointmentDate = {
                $gte: startOfToday,
                $lte: endOfToday
            };
        }

        const appointments = await Appointment.find(queryFilter)
            .populate({
                path: 'userId',
                select: 'name email phone patientId avatar houseNumber street address city state pincode sourceInformation fertilityProfile partnerPatientId partnerRelation coupleId',
                populate: {
                    path: 'partnerPatientId',
                    select: 'name phone patientId coupleId'
                }
            })
            .populate('doctorId', 'name')
            .sort({ tokenNumber: 1, appointmentTime: 1 })
            .lean();

        let Admission = require('../models/admission.model');
        if (req.tenantDb) Admission = getTenantModels(req.tenantDb).Admission;
        
        const patientIds = [...new Set(appointments.map(a => a.userId?._id).filter(Boolean))];
        const activeAdmissions = patientIds.length > 0
            ? await Admission.find({ patientId: { $in: patientIds }, status: 'Admitted' }).select('patientId').lean()
            : [];
        const admittedSet = new Set(activeAdmissions.map(a => String(a.patientId)));

        const enrichedAppointments = appointments.map(apt => ({
            ...apt,
            isHospitalized: apt.userId?._id ? admittedSet.has(String(apt.userId._id)) : false
        }));

        res.json({ success: true, appointments: enrichedAppointments });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

// 5. RESCHEDULE & CANCEL
router.patch('/appointments/:id/reschedule', verifyToken, verifyReception, async (req, res) => {
    const { id } = req.params; const { date, time } = req.body;
    const reschQuery = { _id: id };
    if (req.user.hospitalId) reschQuery.hospitalId = req.user.hospitalId;
    const appt = await Appointment.findOne(reschQuery);
    if (!appt) return res.status(404).json({ success: false, message: 'Appointment not found or unauthorized' });
    appt.appointmentDate = date;
    appt.appointmentTime = time;
    appt.status = 'confirmed';
    await appt.save();
    res.json({ success: true });
});

router.patch('/appointments/:id/cancel', verifyToken, verifyReception, async (req, res) => {
    const cancelQuery = { _id: req.params.id };
    if (req.user.hospitalId) cancelQuery.hospitalId = req.user.hospitalId;
    const appt = await Appointment.findOneAndUpdate(cancelQuery, { status: 'cancelled' });
    if (!appt) return res.status(404).json({ success: false, message: 'Appointment not found or unauthorized' });
    res.json({ success: true });
});

// ─── FOLLOW-UP ELIGIBILITY CHECK ─────────────────────────────────────────────
// Returns whether a patient is within the free follow-up window
router.get('/follow-up-status/:patientId', verifyToken, verifyReception, async (req, res) => {
    try {
        const patient = await User.findById(req.params.patientId);
        if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

        const Hospital = require('../models/hospital.model');
        const hospitalId = req.user.hospitalId || patient.hospitalId;
        const hospital = hospitalId ? await Hospital.findById(hospitalId).select('consultationValidityDays appointmentFee') : null;
        const validityDays = hospital?.consultationValidityDays ?? 3;
        const consultationFee = hospital?.appointmentFee ?? 500;

        const hFilter = hospitalId ? { hospitalId } : {};

        let hasOwnPriorAppointment = false;
        let lastPaidAppointment = null;
        let paidByPartner = false;

        if (patient.coupleId) {
            const coupleUsers = await User.find({ coupleId: patient.coupleId }).select('_id');
            const userIds = coupleUsers.map(u => u._id);

            const anyOwnAppointment = await Appointment.findOne({
                userId: { $in: userIds },
                status: { $ne: 'cancelled' },
                ...hFilter
            }).lean();
            hasOwnPriorAppointment = !!anyOwnAppointment;

            lastPaidAppointment = await Appointment.findOne({
                userId: { $in: userIds },
                amount: { $gt: 0 },
                paymentStatus: { $in: ['Paid', 'paid'] },
                status: { $ne: 'cancelled' },
                ...hFilter
            }).populate('doctorId', 'name').sort({ appointmentDate: -1 }).lean();

            if (lastPaidAppointment && String(lastPaidAppointment.userId) !== String(patient._id)) {
                paidByPartner = true;
            }
        } else {
            const anyOwnAppointment = await Appointment.findOne({
                userId: patient._id,
                status: { $ne: 'cancelled' },
                ...hFilter
            }).lean();
            hasOwnPriorAppointment = !!anyOwnAppointment;

            lastPaidAppointment = await Appointment.findOne({
                userId: patient._id,
                amount: { $gt: 0 },
                paymentStatus: { $in: ['Paid', 'paid'] },
                status: { $ne: 'cancelled' },
                ...hFilter
            }).populate('doctorId', 'name').sort({ appointmentDate: -1 }).lean();
        }

        if (!lastPaidAppointment) {
            return res.json({
                success: true,
                eligible: false,
                reason: 'no_prior_consultation',
                hasOwnPriorAppointment,
                consultationFee,
                validityDays
            });
        }

        const lastDate = new Date(lastPaidAppointment.appointmentDate);
        const validTill = new Date(lastDate);
        validTill.setDate(validTill.getDate() + validityDays);
        validTill.setHours(23, 59, 59, 999);

        const now = new Date();
        const eligible = now <= validTill;
        const daysRemaining = eligible ? Math.ceil((validTill - now) / (1000 * 60 * 60 * 24)) : 0;

        res.json({
            success: true,
            eligible,
            lastConsultationDate: lastDate.toISOString(),
            followUpValidTill: validTill.toISOString(),
            daysRemaining,
            paidByPartner,
            hasOwnPriorAppointment,
            consultationFee,
            validityDays,
            doctorId: lastPaidAppointment?.doctorId?._id || lastPaidAppointment?.doctorId,
            doctorName: lastPaidAppointment?.doctorId?.name || lastPaidAppointment?.doctorName
        });
    } catch (error) {
        console.error('Follow-up status error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 6. BOOK APPOINTMENT (NEW: Assign Doctor)
router.post('/book-appointment', verifyToken, verifyReception, async (req, res) => {
    try {
        const { patientId, doctorId, date, time, notes, paymentMethod, paymentStatus, amount, transactionId, paymentProofUrl, paymentProofFileName } = req.body;

        if (!patientId || !doctorId || !date) {
            return res.status(400).json({ success: false, message: 'Missing booking details' });
        }

        const reqDateMatch = String(date).split('T')[0];
        const todayMatch = new Date().toISOString().split('T')[0];
        if (reqDateMatch < todayMatch) {
            return res.status(400).json({ success: false, message: 'Cannot book appointments in the past' });
        }

        const patient = await User.findById(patientId);
        if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        // Check if patient already has an active appointment on this date (preventing duplicate billing/charges)
        const patientExisting = await Appointment.findOne({
            userId: patient._id,
            appointmentDate: { $gte: startOfDay, $lte: endOfDay },
            status: { $nin: ['cancelled'] }
        });
        if (patientExisting) {
            return res.json({
                success: true,
                message: 'Patient already has an active appointment on this date.',
                appointment: patientExisting
            });
        }

        // Check if patient belongs to a couple and partner has an active appointment today
        let isSharedAppointment = false;
        let partnerAppointment = null;
        if (patient.coupleId) {
            const partnerUser = await User.findOne({
                coupleId: patient.coupleId,
                _id: { $ne: patient._id }
            });
            if (partnerUser) {
                partnerAppointment = await Appointment.findOne({
                    userId: partnerUser._id,
                    appointmentDate: { $gte: startOfDay, $lte: endOfDay },
                    status: { $nin: ['cancelled'] }
                });
                if (partnerAppointment) {
                    isSharedAppointment = true;
                }
            }
        }

        const doctor = await Doctor.findById(doctorId);
        if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

        const hospitalId = req.user.hospitalId || patient.hospitalId;

        const Hospital = require('../models/hospital.model');
        const hospital = hospitalId ? await Hospital.findById(hospitalId).select('appointmentMode') : null;
        const isTokenMode = hospital?.appointmentMode === 'token';

        let finalTime = isSharedAppointment && partnerAppointment ? partnerAppointment.appointmentTime : time;
        let tokenNumber = null;

        if (isTokenMode) {
            const count = await Appointment.countDocuments({
                doctorId: doctor._id,
                appointmentDate: { $gte: startOfDay, $lte: endOfDay },
                status: { $ne: 'cancelled' }
            });
            tokenNumber = count + 1;
            finalTime = `token-${tokenNumber}`;
        } else {
            if (!finalTime) {
                return res.status(400).json({ success: false, message: 'Appointment time is required for slot-based booking' });
            }
            const existing = await Appointment.findOne({
                doctorId: doctor._id,
                appointmentDate: { $gte: startOfDay, $lte: endOfDay },
                appointmentTime: finalTime,
                status: { $ne: 'cancelled' }
            });
            
            let hasConflict = !!existing;
            if (existing && patient.coupleId) {
                const existingUser = await User.findById(existing.userId);
                if (existingUser && existingUser.coupleId === patient.coupleId) {
                    hasConflict = false; // Allow partners to share slot
                }
            }
            
            if (hasConflict) {
                return res.status(400).json({ success: false, message: 'Slot already booked for this doctor at this time!' });
            }
        }

        // ─── Follow-up eligibility check (server-side safety net) ─────────────
        let isFollowUp = false;
        if (!isSharedAppointment) {
            const Hospital = require('../models/hospital.model');
            const hospitalDoc = hospitalId ? await Hospital.findById(hospitalId).select('consultationValidityDays') : null;
            const validityDays = hospitalDoc?.consultationValidityDays ?? 3;
            const hFilter = hospitalId ? { hospitalId } : {};

            // Check this patient's last paid appointment
            let lastPaid = await Appointment.findOne({
                userId: patient._id,
                amount: { $gt: 0 },
                paymentStatus: { $in: ['Paid', 'paid'] },
                status: { $ne: 'cancelled' },
                ...hFilter
            }).sort({ appointmentDate: -1 }).lean();

            // Also check partner if couple
            if (patient.coupleId) {
                const partnerUser = await User.findOne({ coupleId: patient.coupleId, _id: { $ne: patient._id } });
                if (partnerUser) {
                    const partnerPaid = await Appointment.findOne({
                        userId: partnerUser._id,
                        amount: { $gt: 0 },
                        paymentStatus: { $in: ['Paid', 'paid'] },
                        status: { $ne: 'cancelled' },
                        ...hFilter
                    }).sort({ appointmentDate: -1 }).lean();
                    if (partnerPaid && (!lastPaid || new Date(partnerPaid.appointmentDate) > new Date(lastPaid.appointmentDate))) {
                        lastPaid = partnerPaid;
                    }
                }
            }

            if (lastPaid) {
                const validTill = new Date(lastPaid.appointmentDate);
                validTill.setDate(validTill.getDate() + validityDays);
                validTill.setHours(23, 59, 59, 999);
                if (new Date() <= validTill) {
                    isFollowUp = true;
                }
            }
        }

        const finalAmount = (isSharedAppointment || isFollowUp) ? 0 : (Number(amount) || doctor.consultationFee || 0);
        const finalPaymentStatus = (isSharedAppointment || isFollowUp) ? 'Paid' : (paymentStatus || 'Paid');

        const newAppointment = new Appointment({
            userId: patient._id,
            hospitalId,
            patientId: patient.patientId || 'WALK-IN',
            doctorId: doctor._id,
            doctorUserId: doctor.userId,
            doctorName: doctor.name,
            serviceId: doctor.services?.[0] || 'general',
            serviceName: 'Walk-in Visit',
            appointmentDate: new Date(date),
            appointmentTime: finalTime || '',
            tokenNumber,
            amount: finalAmount,
            status: 'confirmed',
            paymentStatus: finalPaymentStatus,
            paymentMethod: paymentMethod || 'Cash',
            paymentProofUrl: paymentMethod === 'Cash' ? null : (paymentProofUrl || null),
            paymentProofFileName: paymentMethod === 'Cash' ? null : (paymentProofFileName || null),
            notes: notes || 'Walk-in created by reception',
            bookedBy: req.user._id
        });

        if (transactionId) {
            newAppointment.transactionId = transactionId;
        }

        await newAppointment.save();

        let newPartnerAppointment = null;
        let partnerTokenNumber = null;
        const bookForPartnerAlso = req.body.bookForPartnerAlso === true || req.body.bookForPartnerAlso === 'true';

        if (bookForPartnerAlso && patient.coupleId) {
            const partnerUser = await User.findOne({
                coupleId: patient.coupleId,
                _id: { $ne: patient._id }
            });
            if (partnerUser) {
                // Check if partner already has an active appointment on this date
                const partnerExisting = await Appointment.findOne({
                    userId: partnerUser._id,
                    appointmentDate: { $gte: startOfDay, $lte: endOfDay },
                    status: { $nin: ['cancelled'] }
                });
                if (!partnerExisting) {
                    let partnerFinalTime = finalTime;
                    if (isTokenMode) {
                        const partnerCount = await Appointment.countDocuments({
                            doctorId: doctor._id,
                            appointmentDate: { $gte: startOfDay, $lte: endOfDay },
                            status: { $ne: 'cancelled' }
                        });
                        partnerTokenNumber = partnerCount + 1;
                        partnerFinalTime = `token-${partnerTokenNumber}`;
                    }

                    newPartnerAppointment = new Appointment({
                        userId: partnerUser._id,
                        hospitalId,
                        patientId: partnerUser.patientId || 'WALK-IN',
                        doctorId: doctor._id,
                        doctorUserId: doctor.userId,
                        doctorName: doctor.name,
                        serviceId: doctor.services?.[0] || 'general',
                        serviceName: 'Walk-in Visit',
                        appointmentDate: new Date(date),
                        appointmentTime: partnerFinalTime || '',
                        tokenNumber: partnerTokenNumber,
                        amount: 0,
                        status: 'confirmed',
                        paymentStatus: 'Paid',
                        paymentMethod: 'Cash',
                        paymentProofUrl: null,
                        paymentProofFileName: null,
                        notes: notes ? `${notes} (Couple Partner Booking)` : 'Walk-in created by reception (Couple Partner Booking)',
                        bookedBy: req.user._id
                    });
                    await newPartnerAppointment.save();
                }
            }
        }

        res.json({
            success: true,
            message: 'Appointment booked successfully!',
            appointment: newAppointment,
            tokenNumber,
            partnerAppointment: newPartnerAppointment,
            partnerTokenNumber
        });

    } catch (error) {
        console.error("Reception Booking Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 7b. CONFIRM PAYMENT for an existing appointment
router.patch('/appointments/:id/confirm-payment', verifyToken, verifyReception, async (req, res) => {
    try {
        const { paymentMethod, amount, paymentProofUrl, paymentProofFileName } = req.body;
        const findQuery = { _id: req.params.id };
        if (req.user.hospitalId) findQuery.hospitalId = req.user.hospitalId;
        const appt = await Appointment.findOne(findQuery);
        if (!appt) return res.status(404).json({ success: false, message: 'Appointment not found or unauthorized' });
        appt.paymentStatus = 'Paid';
        appt.paymentMethod = paymentMethod || appt.paymentMethod || 'Cash';
        appt.paymentProofUrl = appt.paymentMethod === 'Cash' ? null : (paymentProofUrl || appt.paymentProofUrl || null);
        appt.paymentProofFileName = appt.paymentMethod === 'Cash' ? null : (paymentProofFileName || appt.paymentProofFileName || null);
        if (amount !== undefined) appt.amount = amount;
        await appt.save();
        res.json({ success: true, appointment: appt });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 7. PATIENT CHECK-IN
router.post('/check-in', verifyToken, verifyReception, async (req, res) => {
    try {
        const { patientId, appointmentId } = req.body;

        if (!patientId) {
            return res.status(400).json({ success: false, message: 'Patient ID is required' });
        }

        const ClinicalVisit = require('../models/clinicalVisit.model');
        const io = req.app.get('io');

        const visit = new ClinicalVisit({
            patientId,
            appointmentId: appointmentId || null,
            status: 'check_in'
        });
        await visit.save();

        if (appointmentId) {
            await Appointment.findByIdAndUpdate(appointmentId, { status: 'completed' });
        }

        if (io) {
            io.emit('patient_status_changed', { visitId: visit._id, patientId, status: 'check_in', appointmentId });
        }

        res.json({ success: true, message: 'Patient checked in successfully', visit });
    } catch (error) {
        console.error("Check-in Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 8. TRANSACTIONS
router.get('/transactions', verifyToken, verifyReception, async (req, res) => {
    try {
        let queryFilter = { amount: { $gt: 0 }, bookedBy: req.user._id };
        if (req.user.hospitalId) {
            queryFilter.hospitalId = req.user.hospitalId;
        }
        const transactions = await Appointment.find(queryFilter)
            .populate('userId', 'name phone patientId email')
            .populate('doctorId', 'name')
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();
        res.json({ success: true, transactions });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;