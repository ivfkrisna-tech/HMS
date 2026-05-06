const express = require('express');
const router = express.Router();
const Service = require('../models/service.model');
const Doctor = require('../models/doctor.model');
const Hospital = require('../models/hospital.model');

// Get all active services (public route)
router.get('/services', async (req, res) => {
  try {
    // Add cache headers for better performance (5 minutes cache)
    res.set('Cache-Control', 'public, max-age=300');
    
    // Select only needed fields for better performance
    const services = await Service.find({ active: true })
      .select('id title description icon color price duration category features active')
      .sort({ createdAt: -1 })
      .lean(); // Use lean() for better performance (returns plain JS objects)
    
    res.json({ 
      success: true, 
      services,
      count: services.length,
      cached: true
    });
  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({ success: false, message: 'Error fetching services', error: error.message });
  }
});

/**
 * GET /api/public/resolve-domain?domain=portal.apex.com
 * No auth required — used by the frontend to map a custom domain to a hospital.
 * Also used by Caddy's on_demand_tls "ask" URL to validate a domain before issuing a cert.
 */
router.get('/resolve-domain', async (req, res) => {
    try {
        const domain = (req.query.domain || '').toLowerCase().trim();
        if (!domain) {
            return res.status(400).json({ success: false, message: 'domain query param required' });
        }

        const hospital = await Hospital.findOne({ customDomain: domain, isActive: true })
            .select('_id name slug branding logo city appointmentMode clinicType')
            .lean();

        if (!hospital) {
            return res.status(404).json({ success: false, message: 'No hospital registered for this domain' });
        }

        res.json({ success: true, hospital });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;


