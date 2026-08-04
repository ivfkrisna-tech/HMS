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

/**
 * GET /api/public/branding?domain=crm.krishnaivf.com
 * GET /api/public/branding?slug=krishna-ivf
 *
 * Unified pre-login branding API — returns full branding config for a hospital.
 * Used by the frontend BrandingContext to theme the login page BEFORE authentication.
 * Accepts either a custom domain or a slug (subdomain).
 * No auth required.
 */
router.get('/branding', async (req, res) => {
    try {
        const { normalizeDomain } = require('../utils/domainHelper');
        const domain = normalizeDomain(req.query.domain);
        const slug = (req.query.slug || '').toLowerCase().trim();

        if (!domain && !slug) {
            return res.status(400).json({ success: false, message: 'Either domain or slug query param is required' });
        }

        let hospital = null;

        if (domain) {
            hospital = await Hospital.findOne({ customDomain: domain, isActive: true }).lean();
        }

        if (!hospital && slug) {
            hospital = await Hospital.findOne({ slug, isActive: true }).lean();
        }

        if (!hospital) {
            return res.status(404).json({ success: false, message: 'Hospital not found' });
        }

        // Merge top-level fields into a flat branding response
        const branding = hospital.branding || {};
        res.json({
            success: true,
            hospitalId: hospital._id,
            hospitalName: hospital.name,
            slug: hospital.slug,
            logo: hospital.logo,
            customDomain: hospital.customDomain,
            whiteLabelEnabled: hospital.whiteLabelEnabled || false,
            loginBackground: hospital.loginBackground || '',
            clinicType: hospital.clinicType,
            appointmentMode: hospital.appointmentMode,
            branding: {
                appName: branding.appName || hospital.name,
                tagline: branding.tagline || '',
                logoUrl: branding.logoUrl || hospital.logo || '',
                faviconUrl: branding.faviconUrl || '',
                primaryColor: branding.primaryColor || '#14b8a6',
                secondaryColor: branding.secondaryColor || '#0a2647',
                accentColor: branding.accentColor || '#6366f1',
                successColor: branding.successColor || '#10b981',
                backgroundColor: branding.backgroundColor || '#f8fafc',
                textColor: branding.textColor || '#1e293b',
                supportEmail: branding.supportEmail || hospital.email || '',
                supportPhone: branding.supportPhone || hospital.phone || '',
                address: branding.address || hospital.address || '',
                websiteUrl: branding.websiteUrl || hospital.website || '',
                footerText: branding.footerText || '',
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;


