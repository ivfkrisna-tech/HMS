const User = require('../models/user.model');
const Hospital = require('../models/hospital.model');

/**
 * Migration routine: Backfill adminNumber and status for all existing Hospital Admins.
 * Ensures existing hospital admin accounts continue working seamlessly with the new
 * multiple hospital admin architecture.
 */
async function migrateHospitalAdmins() {
    try {
        console.log('🔄 Checking Hospital Admin migration...');

        // Find all hospital admins
        const hospitalAdmins = await User.find({ role: 'hospitaladmin' }).sort({ createdAt: 1 });

        if (!hospitalAdmins || hospitalAdmins.length === 0) {
            console.log('✓ No Hospital Admins to migrate.');
            return;
        }

        // Group admins by hospitalId
        const adminsByHospital = {};
        for (const admin of hospitalAdmins) {
            const hid = admin.hospitalId ? String(admin.hospitalId) : 'unassigned';
            if (!adminsByHospital[hid]) {
                adminsByHospital[hid] = [];
            }
            adminsByHospital[hid].push(admin);
        }

        let updatedCount = 0;

        for (const [hospitalId, admins] of Object.entries(adminsByHospital)) {
            // Find existing max adminNumber among those that already have one
            let maxNumber = 0;
            for (const admin of admins) {
                if (typeof admin.adminNumber === 'number' && admin.adminNumber > maxNumber) {
                    maxNumber = admin.adminNumber;
                }
            }

            // Assign sequential adminNumber to those that don't have one yet
            for (const admin of admins) {
                let modified = false;

                if (admin.adminNumber === undefined || admin.adminNumber === null) {
                    maxNumber += 1;
                    admin.adminNumber = maxNumber;
                    modified = true;
                }

                if (!admin.status) {
                    admin.status = 'Active';
                    modified = true;
                }

                if (modified) {
                    await admin.save();
                    updatedCount++;
                }
            }

            // Ensure hospital record still references an admin if legacy adminUserId is empty
            if (hospitalId !== 'unassigned' && admins.length > 0) {
                const hospital = await Hospital.findById(hospitalId);
                if (hospital && !hospital.adminUserId) {
                    hospital.adminUserId = admins[0]._id;
                    await hospital.save();
                }
            }
        }

        console.log(`✅ Hospital Admin migration completed. (${updatedCount} records updated/verified)`);
    } catch (err) {
        console.error('⚠️  Hospital Admin migration notice:', err.message);
    }
}

module.exports = migrateHospitalAdmins;
