const express = require('express');
const router = express.Router();
const Inventory = require('../models/inventory.model');
const { verifyToken } = require('../middleware/auth.middleware');

const User = require('../models/user.model');
const Role = require('../models/role.model');

// GET all inventory
router.get('/inventory', verifyToken, async (req, res) => {
    try {
        let pharmacyIds = [req.user.id];
        let query = { pharmacyId: req.user.id };

        if (req.user.hospitalId) {
            const pharmacyRoles = await Role.find({ name: { $regex: /pharmac/i } });
            if (pharmacyRoles.length > 0) {
                const pharmacists = await User.find({ hospitalId: req.user.hospitalId, role: { $in: pharmacyRoles.map(r => r._id) } });
                const ids = pharmacists.map(p => p._id);
                if (ids.length > 0) pharmacyIds = ids;
            }
            query = {
                $or: [
                    { pharmacyId: { $in: pharmacyIds } },
                    { hospitalId: req.user.hospitalId }
                ]
            };
        } else {
             query = { pharmacyId: req.user.id };
        }

        const items = await Inventory.find(query).sort({ createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST new medicine
router.post('/inventory', verifyToken, async (req, res) => {
    try {
        const newItem = new Inventory({
            ...req.body,
            pharmacyId: req.user.id,
            hospitalId: req.user.hospitalId
        });

        await newItem.save();
        res.status(201).json({ success: true, data: newItem });
    } catch (error) {
        // FIX: Send back the specific Mongoose error message
        console.error("Mongoose Save Error:", error.message);
        res.status(400).json({
            success: false,
            message: error.message // This will now say EXACTLY what failed
        });
    }
});

// DELETE medicine
router.delete('/inventory/:id', verifyToken, async (req, res) => {
    try {
        const deleteQuery = { _id: req.params.id };
        if (req.user.hospitalId) {
            deleteQuery.hospitalId = req.user.hospitalId;
        } else {
            deleteQuery.pharmacyId = req.user.id;
        }
        const deletedItem = await Inventory.findOneAndDelete(deleteQuery);

        if (!deletedItem) {
            return res.status(404).json({ success: false, message: "Item not found or unauthorized" });
        }

        res.json({ success: true, message: 'Item deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
// UPDATE medicine
router.put('/inventory/:id', verifyToken, async (req, res) => {
    try {
        const updateQuery = { _id: req.params.id };
        if (req.user.hospitalId) {
            updateQuery.hospitalId = req.user.hospitalId;
        } else {
            updateQuery.pharmacyId = req.user.id;
        }
        
        const updatedItem = await Inventory.findOneAndUpdate(
            updateQuery,
            { 
                $set: {
                    ...req.body,
                    isMultiDose: Boolean(req.body.isMultiDose),
                    packVolume: Number(req.body.packVolume) || 1,
                    billingType: req.body.billingType || 'FULL_UNIT'
                }
            },
            { new: true, runValidators: true }
        );

        if (!updatedItem) {
            return res.status(404).json({ success: false, message: "Item not found or unauthorized" });
        }

        res.json({ success: true, data: updatedItem });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- VENDOR MANAGEMENT ---
const Vendor = require('../models/vendor.model');

const validateVendorPayload = (data) => {
    const { vendorName, phone, gstin } = data;
    if (!vendorName || !vendorName.trim()) return "Vendor name is required";
    if (phone && !/^\d{10}$/.test(phone)) return "Phone number must be exactly 10 digits";
    if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin.trim())) {
        return "Invalid GSTIN format";
    }
    return null;
};

// Add Vendor
router.post('/vendors', verifyToken, async (req, res) => {
    try {
        if (!req.user.hospitalId) {
            return res.status(403).json({ success: false, message: 'Hospital context required' });
        }
        
        const validationError = validateVendorPayload(req.body);
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError });
        }

        const newVendor = new Vendor({
            ...req.body,
            hospitalId: req.user.hospitalId
        });
        await newVendor.save();
        res.status(201).json({ success: true, data: newVendor });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get Vendors
router.get('/vendors', verifyToken, async (req, res) => {
    try {
        if (!req.user.hospitalId) {
            return res.json({ success: true, data: [] });
        }
        const vendors = await Vendor.find({ hospitalId: req.user.hospitalId }).sort({ createdAt: -1 });
        res.json({ success: true, data: vendors });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update Vendor
router.put('/vendors/:id', verifyToken, async (req, res) => {
    try {
        if (!req.user.hospitalId) {
            return res.status(403).json({ success: false, message: 'Hospital context required' });
        }

        const validationError = validateVendorPayload(req.body);
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError });
        }

        const updatedVendor = await Vendor.findOneAndUpdate(
            { _id: req.params.id, hospitalId: req.user.hospitalId },
            { $set: req.body },
            { new: true, runValidators: true }
        );
        if (!updatedVendor) {
            return res.status(404).json({ success: false, message: "Vendor not found or unauthorized" });
        }
        res.json({ success: true, data: updatedVendor });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- REVENUE & COLLECTIONS ANALYTICS ---
const PharmacyOrder = require('../models/pharmacyOrder.model');
const PharmacyReturn = require('../models/pharmacyReturn.model');

router.get('/analytics/collections', verifyToken, async (req, res) => {
    try {
        if (!req.user.hospitalId) {
            return res.status(403).json({ success: false, message: 'Hospital context required' });
        }

        const { startDate, endDate } = req.query;
        let start = new Date();
        start.setHours(0, 0, 0, 0);
        let end = new Date();
        end.setHours(23, 59, 59, 999);

        if (startDate) {
            start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
        }
        if (endDate) {
            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
        }

        const dateFilter = {
            hospitalId: req.user.hospitalId,
            createdAt: { $gte: start, $lte: end }
        };

        const orders = await PharmacyOrder.find({
            ...dateFilter,
            paymentStatus: 'Paid',
            orderStatus: 'Completed'
        }).populate('userId', 'name phone');

        const returns = await PharmacyReturn.find(dateFilter);

        let totalGrossSales = 0;
        let cashAmount = 0;
        let upiAmount = 0;
        let cardAmount = 0;

        orders.forEach(order => {
            totalGrossSales += (order.totalAmount || 0);
            // Assuming default Cash if no specific payment mode is tracked in PharmacyOrder yet.
            // If paymentMode exists, we map it, else fallback to Cash
            const mode = (order.paymentMode || 'Cash').toLowerCase();
            if (mode.includes('upi')) upiAmount += (order.totalAmount || 0);
            else if (mode.includes('card')) cardAmount += (order.totalAmount || 0);
            else cashAmount += (order.totalAmount || 0);
        });

        let totalReturnsRefunded = 0;
        returns.forEach(r => {
            if (r.returnType === 'Refund') {
                totalReturnsRefunded += (r.refundAmount || 0);
            }
        });

        const netCollection = totalGrossSales - totalReturnsRefunded;

        res.json({
            success: true,
            summary: {
                totalGrossSales,
                totalReturnsRefunded,
                netCollection,
                cashAmount,
                upiAmount,
                cardAmount
            },
            orders,
            returns
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;