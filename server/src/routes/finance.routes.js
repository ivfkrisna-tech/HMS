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

        const Appointment = require('../models/appointment.model');
        const LabReport = require('../models/labReport.model');
        const PharmacyOrder = require('../models/pharmacyOrder.model');
        const Inventory = require('../models/inventory.model');
        const FacilityCharge = require('../models/facilityCharge.model');
        const Admission = require('../models/admission.model');

        // 1. Consultations Revenue
        const consultations = await Appointment.find({
            paymentStatus: { $in: ['paid', 'Paid', 'PAID'] },
            ...dateFilter,
            ...hospitalFilter
        });
        const totalConsultationRevenue = consultations.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

        // 2. Lab Tests Revenue
        const labReports = await LabReport.find({
            paymentStatus: { $in: ['PAID', 'paid', 'Paid'] },
            ...dateFilter,
            ...hospitalFilter
        });
        const totalLabRevenue = labReports.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

        // 3. Medicines Revenue & Cost
        const pharmacyOrders = await PharmacyOrder.find({
            paymentStatus: { $in: ['Paid', 'paid', 'PAID'] },
            ...dateFilter,
            ...hospitalFilter
        });

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
        const facilityCharges = await FacilityCharge.find({
            paymentStatus: { $in: ['Paid', 'paid', 'PAID'] },
            ...dateFilter,
            ...hospitalFilter
        });
        const totalFacilityRevenue = facilityCharges.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);

        // 5. Admissions Revenue
        const admissions = await Admission.find({
            paymentStatus: { $in: ['Paid', 'paid', 'PAID'] },
            ...dateFilter,
            ...hospitalFilter
        });
        const totalAdmissionRevenue = admissions.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);

        // Overall Totals
        const totalRevenue = totalConsultationRevenue + totalLabRevenue + totalMedicineRevenue + totalFacilityRevenue + totalAdmissionRevenue;
        const totalProfit = totalConsultationRevenue + totalLabRevenue + totalMedicineProfit + totalFacilityRevenue + totalAdmissionRevenue;

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
                }
            }
        });

    } catch (error) {
        console.error('Finance Analytics Error:', error);
        res.status(500).json({ success: false, message: 'Server Error fetching finance data' });
    }
});

module.exports = router;