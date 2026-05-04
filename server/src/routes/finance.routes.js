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
            const role = req.user.role ? req.user.role.toLowerCase() : '';
            const dynRoleStr = req.user._roleData?.name ? req.user._roleData.name.toLowerCase() : '';
            const permissions = req.user._roleData?.permissions || [];
            
            const allowed = ['accountant', 'billing', 'cashier', 'centraladmin', 'superadmin', 'hospitaladmin', 'admin'];
            
            const hasAccess = allowed.some(keyword => dynRoleStr.includes(keyword) || role.includes(keyword));
            
            if (hasAccess || permissions.includes('*') || permissions.includes('finance_access')) {
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
        const role = req.user.role ? req.user.role.toLowerCase() : '';
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
            if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
            if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
        }

        let appointmentDateFilter = {};
        if (startDate || endDate) {
            appointmentDateFilter.appointmentDate = {};
            if (startDate) appointmentDateFilter.appointmentDate.$gte = new Date(startDate);
            if (endDate) appointmentDateFilter.appointmentDate.$lte = new Date(endDate);
        }

        // HARD ISOLATION: Direct hospitalId filter — no doctor lookup needed
        let hospitalFilter = {};
        if (!req.tenantDb && targetHospitalId) {
            hospitalFilter = { hospitalId: targetHospitalId };
        }

        let Appointment = require('../models/appointment.model');
        let LabReport = require('../models/labReport.model');
        let PharmacyOrder = require('../models/pharmacyOrder.model');
        let Inventory = require('../models/inventory.model');
        
        if (req.tenantDb) {
            const tenantModels = getTenantModels(req.tenantDb);
            Appointment = tenantModels.Appointment || Appointment;
            LabReport = tenantModels.LabReport || LabReport;
            PharmacyOrder = tenantModels.PharmacyOrder || PharmacyOrder;
            Inventory = tenantModels.Inventory || Inventory; // Fallback to master if tenant doesn't have it
        }

        // 1. Consultations Revenue
        const consultations = await Appointment.find({
            paymentStatus: { $in: ['paid', 'Paid', 'PAID'] },
            ...appointmentDateFilter,
            ...hospitalFilter
        });
        const totalConsultationRevenue = consultations.reduce((acc, curr) => acc + (curr.amount || 0), 0);

        // 2. Lab Tests Revenue
        const labReports = await LabReport.find({
            paymentStatus: { $in: ['PAID', 'paid', 'Paid'] },
            ...dateFilter,
            ...hospitalFilter
        });
        const totalLabRevenue = labReports.reduce((acc, curr) => acc + (curr.amount || 0), 0);

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
            if (order.totalAmount > 0 || order.totalCost > 0) {
                totalMedicineRevenue += order.totalAmount || 0;
                totalMedicineCost += order.totalCost || 0;
            } else {
                // If the order has items but no saved amount/cost, estimate it now using Inventory
                for (const item of order.items) {
                    const escapedName = (item.medicineName || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const invItem = await Inventory.findOne({ name: { $regex: new RegExp(`^${escapedName}$`, 'i') } });
                    if (invItem) {
                        const qty = 1; // Simplistic approximation if quantity isn't cleanly stored
                        totalMedicineRevenue += (invItem.sellingPrice || 0) * qty;
                        totalMedicineCost += (invItem.buyingPrice || 0) * qty;
                    }
                }
            }
        }

        const totalMedicineProfit = totalMedicineRevenue - totalMedicineCost;

        // 4. Overall Totals
        const totalRevenue = totalConsultationRevenue + totalLabRevenue + totalMedicineRevenue;
        const totalProfit = totalConsultationRevenue + totalLabRevenue + totalMedicineProfit;

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
                }
            }
        });

    } catch (error) {
        console.error('Finance Analytics Error:', error);
        res.status(500).json({ success: false, message: 'Server Error fetching finance data' });
    }
});

module.exports = router;
