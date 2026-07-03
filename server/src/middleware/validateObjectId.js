const mongoose = require('mongoose');

const validateObjectId = (req, res, next, val, name) => {
    if (!mongoose.Types.ObjectId.isValid(val)) {
        return res.status(400).json({
            success: false,
            message: `Invalid ${name} format: must be a valid MongoDB ObjectId`
        });
    }
    next();
};

module.exports = validateObjectId;
