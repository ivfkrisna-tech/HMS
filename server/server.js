require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/db/db');

const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const DEPLOYMENT_MODE = process.env.DEPLOYMENT_MODE || 'cloud';

// 1. Connect to Database
connectDB();

// 2. HTTP Server and Socket.io
const server = http.createServer(app);

const Hospital = require('./src/models/hospital.model');
const { normalizeDomain } = require('./src/utils/domainHelper');

// Cache for dynamic custom domain CORS lookups (5-minute TTL) — shared with Socket.IO
const _socketCorsDomainCache = new Map();
const SOCKET_CORS_CACHE_TTL = 5 * 60 * 1000;

const isAllowedOrigin = (origin) => {
    if (!origin) return true;
    // 1. Localhost allow karein
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;

    // 2. Apni current local IP allow karein
    if (origin.includes('192.168.183.171')) return true;

    // Support multi-tenant subdomains during development
    if (/^https?:\/\/[\w-]+\.localhost(:\d+)?$/.test(origin)) return true;

    if (origin === 'https://medical365.in') return true;
    if (origin === 'https://www.medical365.in') return true;
    if (/^https:\/\/[\w-]+\.medical365\.in$/.test(origin)) return true;
    if (origin === 'https://freebieshub.in') return true;
    if (origin === 'https://www.freebieshub.in') return true;
    if (/^https:\/\/[\w-]+\.freebieshub\.in$/.test(origin)) return true;
    if (origin === 'https://krisnaivfgroup5.com') return true;
    if (origin === 'https://www.krisnaivfgroup5.com') return true;
    if (/^https:\/\/[\w-]+\.krisnaivfgroup5\.com$/.test(origin)) return true;
    return false;
};

const io = new Server(server, {
    cors: {
        origin: async (origin, callback) => {
            if (isAllowedOrigin(origin)) return callback(null, true);

            // Dynamic: check if origin is a registered custom domain
            try {
                const hostname = normalizeDomain(origin);
                if (!hostname) return callback(new Error('CORS blocked: ' + origin), false);

                const cached = _socketCorsDomainCache.get(hostname);
                if (cached && (Date.now() - cached.ts) < SOCKET_CORS_CACHE_TTL) {
                    return cached.allowed ? callback(null, true) : callback(new Error('CORS blocked: ' + origin), false);
                }

                const hospital = await Hospital.findOne({ customDomain: hostname, isActive: true }).select('_id').lean();
                const allowed = !!hospital;
                _socketCorsDomainCache.set(hostname, { allowed, ts: Date.now() });

                if (allowed) return callback(null, true);
            } catch (err) {
                console.warn('[Socket.IO CORS] Dynamic domain lookup error:', err.message);
            }

            callback(new Error('CORS blocked: ' + origin), false);
        },
        methods: ["GET", "POST"]
    }
});

app.set('io', io);

io.on('connection', (socket) => {
    console.log('New client connected', socket.id);
    socket.on('join', (room) => {
        socket.join(room);
        console.log(`Socket ${socket.id} joined room ${room}`);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected', socket.id);
    });
});

// 3. Attach tunnel relay (cloud only — accepts WebSocket connections from local servers)
if (DEPLOYMENT_MODE !== 'local') {
    const tunnelServer = require('./src/utils/tunnelServer');
    tunnelServer.attach(server);
}

// 4. Start Server
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT} [mode: ${DEPLOYMENT_MODE}]`);

    // Health check: Verify LibreOffice availability for PDF conversion
    try {
        const ConsentFillerService = require('./src/services/consentFiller.service');
        ConsentFillerService.checkLibreOffice();
    } catch (healthErr) {
        console.warn(`[Startup] LibreOffice health check skipped: ${healthErr.message}`);
    }

    // 5. Post-startup services (after DB is ready — give it 3s)
    setTimeout(() => {
        if (DEPLOYMENT_MODE === 'local') {
            // Start sync service — pushes stats to cloud every 15 min
            // const syncService = require('./src/utils/syncService');
            // syncService.start();

            // Start tunnel client — maintains WebSocket to cloud for patient app
            // const tunnelClient = require('./src/utils/tunnelClient');
            // tunnelClient.setApp(app);
            // tunnelClient.connect();
        }
    }, 3000);
});
// Trigger Restart