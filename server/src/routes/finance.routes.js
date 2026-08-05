const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { verifyToken } = require('../middleware/auth.middleware');
const { resolveTenant } = require('../middleware/tenantMiddleware');
const { getTenantModels } = require('../db/tenantModels');

// Middleware to check if user has access to finance data
const verifyFinanceAccess = async (req, res, next) => {
    try {
        await verifyToken(req, res, () => {
            const role = String(req.user.role || '').toLowerCase();
            const dynRoleStr = String(req.user._roleData?.name || '').toLowerCase();
            const permissions = req.user._roleData?.permissions || [];

            // Added 'reception' and 'receptionist' to the allowed array list keyword references
            const allowed = ['accountant', 'billing', 'cashier', 'centraladmin', 'superadmin', 'hospitaladmin', 'admin', 'reception', 'receptionist'];

            const hasAccess = allowed.some(keyword => dynRoleStr.includes(keyword) || role.includes(keyword));
            
            if (hasAccess || permissions.includes('*') || permissions.includes('finance_access') || permissions.includes('finance_view')) {
                return next();
            }
            return res.status(403).json({ success: false, message: `Finance access required. Role: ${dynRoleStr || role}` });
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET Financial Dashboard Analytics
router.get('/dashboard', verifyFinanceAccess, resolveTenant, async (req, res) => {
    try {
        const { startDate, endDate, hospitalId } = req.query;

        // Determine target hospital ID
        const role = String(req.user.role || '').toLowerCase();
        let targetHospitalId;

        if (role === 'superadmin' || role === 'centraladmin') {
            // Central admins may pass an optional hospitalId to filter; if none, see all
            targetHospitalId = hospitalId || null;
        } else {
            // All other roles are strictly scoped to their own hospital
            if (!req.tenantDb && !req.user.hospitalId) {
                return res.json({
                    success: true,
                    data: {
                        totalRevenue: 0, totalProfit: 0,
                        consultations: { count: 0, revenue: 0 },
                        labTests: { count: 0, revenue: 0 },
                        medicines: { count: 0, revenue: 0, cost: 0, profit: 0 }
                    }
                });
            }
            targetHospitalId = req.user.hospitalId ? req.user.hospitalId.toString() : null;
        }

        // Date filters
        let dateFilter = {};
        if (startDate || endDate) {
            dateFilter.createdAt = {};
            if (startDate && startDate !== 'undefined') dateFilter.createdAt.$gte = new Date(startDate);
            if (endDate && endDate !== 'undefined') dateFilter.createdAt.$lte = new Date(endDate);
            // Clean up if empty
            if (Object.keys(dateFilter.createdAt).length === 0) delete dateFilter.createdAt;
        }

        // HARD ISOLATION: Direct hospitalId filter — no doctor lookup needed
        let hospitalFilter = {};
        if (targetHospitalId) {
            hospitalFilter = { hospitalId: targetHospitalId };
        }

        const MasterAppointment = require('../models/appointment.model');
        const MasterLabReport = require('../models/labReport.model');
        const MasterPharmacyOrder = require('../models/pharmacyOrder.model');
        const Inventory = require('../models/inventory.model');
        const MasterFacilityCharge = require('../models/facilityCharge.model');
        const MasterAdmission = require('../models/admission.model');
        const MasterTreatmentPackage = require('../models/treatmentPackage.model');

        let TAppointment, TLabReport, TPharmacyOrder, TFacilityCharge, TAdmission, TTreatmentPackage;
        if (req.tenantDb) {
            const tenantModels = getTenantModels(req.tenantDb);
            TAppointment = tenantModels.Appointment;
            TLabReport = tenantModels.LabReport;
            TPharmacyOrder = tenantModels.PharmacyOrder;
            TFacilityCharge = tenantModels.FacilityCharge;
            TAdmission = tenantModels.Admission;
            TTreatmentPackage = tenantModels.TreatmentPackage;
        }

        const queryObj = {
            paymentStatus: { $in: ['paid', 'Paid', 'PAID'] },
            ...dateFilter,
            ...hospitalFilter
        };

        // 1. Consultations Revenue
        const [masterConsultations, tenantConsultations] = await Promise.all([
            MasterAppointment.find(queryObj).lean(),
            TAppointment ? TAppointment.find(queryObj).lean() : Promise.resolve([])
        ]);
        const consultations = [...masterConsultations, ...tenantConsultations];
        const totalConsultationRevenue = consultations.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

        // 2. Lab Tests Revenue
        const [masterLabReports, tenantLabReports] = await Promise.all([
            MasterLabReport.find(queryObj).lean(),
            TLabReport ? TLabReport.find(queryObj).lean() : Promise.resolve([])
        ]);
        const labReports = [...masterLabReports, ...tenantLabReports];
        const totalLabRevenue = labReports.reduce((acc, curr) => {
            const baseAmount = Number(curr.amount) || 0;
            const sgstAmt = Number(curr.sgst) || 0;
            const cgstAmt = Number(curr.cgst) || 0;
            const discount = Number(curr.discount) || 0;
            return acc + (baseAmount + sgstAmt + cgstAmt - discount);
        }, 0);

        // 3. Medicines Revenue & Cost
        const [masterPharmacyOrders, tenantPharmacyOrders] = await Promise.all([
            MasterPharmacyOrder.find(queryObj).lean(),
            TPharmacyOrder ? TPharmacyOrder.find(queryObj).lean() : Promise.resolve([])
        ]);
        const pharmacyOrders = [...masterPharmacyOrders, ...tenantPharmacyOrders];

        let totalMedicineRevenue = 0;
        let totalMedicineCost = 0;

        // Aggregate totals stored in order if any, or fall back to calculating via inventory mapping
        for (const order of pharmacyOrders) {
            if (Number(order.totalAmount) > 0 || Number(order.totalCost) > 0) {
                totalMedicineRevenue += Number(order.totalAmount) || 0;
                totalMedicineCost += Number(order.totalCost) || 0;
            } else {
                // If the order has items but no saved amount/cost, estimate it now using Inventory
                for (const item of order.items) {
                    const escapedName = (item.medicineName || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const invItem = await Inventory.findOne({ name: { $regex: new RegExp(`^${escapedName}$`, 'i') } });
                    if (invItem) {
                        const qty = 1; // Simplistic approximation if quantity isn't cleanly stored
                        totalMedicineRevenue += (Number(invItem.sellingPrice) || 0) * qty;
                        totalMedicineCost += (Number(invItem.buyingPrice) || 0) * qty;
                    }
                }
            }
        }

        const totalMedicineProfit = totalMedicineRevenue - totalMedicineCost;

        // 4. Facility Charges Revenue
        const [masterFacilityCharges, tenantFacilityCharges] = await Promise.all([
            MasterFacilityCharge.find(queryObj).lean(),
            TFacilityCharge ? TFacilityCharge.find(queryObj).lean() : Promise.resolve([])
        ]);
        const facilityCharges = [...masterFacilityCharges, ...tenantFacilityCharges];
        const totalFacilityRevenue = facilityCharges.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);

        // 5. Admissions Revenue
        const [masterAdmissions, tenantAdmissions] = await Promise.all([
            MasterAdmission.find(queryObj).lean(),
            TAdmission ? TAdmission.find(queryObj).lean() : Promise.resolve([])
        ]);
        const admissions = [...masterAdmissions, ...tenantAdmissions];
        const totalAdmissionRevenue = admissions.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);

        // 6. Packages Revenue
        const [masterPackages, tenantPackages] = await Promise.all([
            MasterTreatmentPackage.find(queryObj).lean(),
            TTreatmentPackage ? TTreatmentPackage.find(queryObj).lean() : Promise.resolve([])
        ]);
        const packages = [...masterPackages, ...tenantPackages];
        const totalPackageRevenue = packages.reduce((acc, curr) => acc + (curr.finalAmount || curr.totalAmount || 0), 0);

        // Overall Totals
        const totalRevenue = totalConsultationRevenue + totalLabRevenue + totalMedicineRevenue + totalFacilityRevenue + totalAdmissionRevenue + totalPackageRevenue;
        const totalProfit = totalConsultationRevenue + totalLabRevenue + totalMedicineProfit + totalFacilityRevenue + totalAdmissionRevenue + totalPackageRevenue;

        res.json({
            success: true,
            data: {
                totalRevenue,
                totalProfit,
                consultations: {
                    count: consultations.length,
                    revenue: totalConsultationRevenue
                },
                labTests: {
                    count: labReports.length,
                    revenue: totalLabRevenue
                },
                medicines: {
                    count: pharmacyOrders.length,
                    revenue: totalMedicineRevenue,
                    cost: totalMedicineCost,
                    profit: totalMedicineProfit
                },
                facilityCharges: {
                    count: facilityCharges.length,
                    revenue: totalFacilityRevenue
                },
                admissions: {
                    count: admissions.length,
                    revenue: totalAdmissionRevenue
                },
                packages: {
                    count: packages.length,
                    revenue: totalPackageRevenue
                }
            }
        });

    } catch (error) {
        console.error('Finance Analytics Error:', error);
        res.status(500).json({ success: false, message: 'Server Error fetching finance data' });
    }
});

module.exports = router;