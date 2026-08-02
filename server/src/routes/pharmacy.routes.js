const express = require('express');
const router = express.Router();
const Inventory = require('../models/inventory.model');
const PurchaseInvoice = require('../models/purchaseInvoice.model');
const { verifyToken, verifyAdmin } = require('../middleware/auth.middleware');
const multer = require('multer');
const { parseInvoice } = require('../utils/invoiceParser');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed!'), false);
        }
    }
});

const fs = require('fs');
const path = require('path');
const invoiceStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, '../../uploads/invoices');
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const uploadInvoice = multer({
    storage: invoiceStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed!'), false);
        }
    }
});

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
        if (req.body.purchaseInvoiceId) {
            const existing = await Inventory.findOne({
                purchaseInvoiceId: req.body.purchaseInvoiceId,
                name: req.body.name,
                batchNumber: req.body.batchNumber
            });
            if (existing) {
                return res.status(400).json({ success: false, message: 'Medicine already imported from this invoice.' });
            }
        }

        const newItem = new Inventory({
            ...req.body,
            pharmacyId: req.user.id,
            hospitalId: req.user.hospitalId
        });

        await newItem.save();

        if (req.body.purchaseInvoiceId) {
            const invoice = await PurchaseInvoice.findById(req.body.purchaseInvoiceId);
            if (invoice) {
                invoice.importedMedicines += 1;
                invoice.remainingMedicines = invoice.totalMedicines - invoice.importedMedicines;
                if (invoice.remainingMedicines <= 0) invoice.status = 'Completed';
                await invoice.save();
            }
        }

        res.status(201).json({ success: true, data: newItem });
    } catch (error) {
        console.error("Mongoose Save Error:", error.message);
        res.status(400).json({
            success: false,
            message: error.message
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

// --- PURCHASE INVOICE MODULE ---

// POST Upload Purchase Invoice
router.post('/purchase-invoice/upload', verifyToken, uploadInvoice.single('invoice'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded or invalid file format.' });
        }

        const originalName = req.file.originalname;
        const generatedName = req.file.filename || `${Date.now()}-${originalName}`;
        const size = req.file.size;

        const uploadDate = new Date();
        const uploadTime = uploadDate.toTimeString().split(' ')[0];

        // 1. Parse PDF immediately
        const fileBuffer = fs.readFileSync(req.file.path);
        const parsedData = await parseInvoice(fileBuffer);
        const { vendorName, invoiceNumber, invoiceDate, grandTotal, taxableAmount, discount, cgst, sgst, igst } = parsedData.invoice;
        const totalMedicines = parsedData.invoice.totalMedicines || parsedData.medicines.length;
        const purchaseQty = parsedData.invoice.purchaseQty;
        const freeQty = parsedData.invoice.freeQty;

        // 2. Prevent Duplicate Invoice
        if (vendorName && invoiceNumber) {
            const existingInvoice = await PurchaseInvoice.findOne({ vendorName, invoiceNumber });
            if (existingInvoice) {
                // Remove the uploaded file since it's a duplicate
                try {
                    fs.unlinkSync(req.file.path);
                } catch (unlinkErr) {
                    console.error("Failed to delete file:", unlinkErr);
                }
                return res.status(400).json({ success: false, message: 'Invoice Already Exists.' });
            }
        }

        // 3. Create Database Record
        const newInvoice = new PurchaseInvoice({
            vendorName,
            invoiceNumber,
            invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
            grandTotal,
            taxableAmount,
            discount,
            cgst,
            sgst,
            igst,
            totalMedicines,
            purchaseQty,
            freeQty,
            uploadedBy: {
                name: req.user.name || 'Unknown',
                email: req.user.email || 'Unknown',
                userId: req.user.id
            },
            uploadedPDF: {
                originalName,
                generatedName,
                size
            },
            uploadDate,
            uploadTime,
            status: 'Pending',
            importedMedicines: 0,
            remainingMedicines: totalMedicines
        });

        await newInvoice.save();

        res.status(201).json({
            success: true,
            message: 'Invoice uploaded successfully',
            invoice: newInvoice,
            medicines: parsedData.medicines
        });
    } catch (error) {
        // If parsing fails or any other error, remove the uploaded file
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (unlinkErr) {
                console.error("Failed to delete file:", unlinkErr);
            }
        }
        console.error("Upload Invoice Error:", error);
        res.status(500).json({ success: false, message: error.message || 'Failed to upload invoice.' });
    }
});

// GET all purchase invoices
router.get('/purchase-invoice', verifyToken, async (req, res) => {
    try {
        const invoices = await PurchaseInvoice.find().sort({ createdAt: -1 });
        res.json({ success: true, data: invoices });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET single purchase invoice by ID
router.get('/purchase-invoice/:id', verifyToken, async (req, res) => {
    try {
        const invoice = await PurchaseInvoice.findById(req.params.id);
        if (!invoice) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }
        res.json({ success: true, data: invoice });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// DELETE purchase invoice (Admin only)
router.delete('/purchase-invoice/:id', verifyAdmin, async (req, res) => {
    try {
        // Admin validation logic (assuming user role exists or can be verified, here just verifyToken is applied)
        // If there's an isAdmin middleware or we check req.user.role, we can add it here.
        const invoice = await PurchaseInvoice.findByIdAndDelete(req.params.id);
        if (!invoice) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }
        res.json({ success: true, message: 'Invoice deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;