# ─────────────────────────────────────────────────────────────────────────────
# HMS Backend - Production Dockerfile
# Uses Node.js 18 on Debian Bullseye with LibreOffice for DOCX → PDF conversion
# ─────────────────────────────────────────────────────────────────────────────

FROM node:18-bullseye-slim

# ── Install LibreOffice + Fonts ──────────────────────────────────────────────
# libreoffice-writer: Core Writer component for DOCX → PDF
# fonts-liberation: Arial, Times New Roman, Courier New equivalents
# fonts-dejavu-core: DejaVu font family (excellent Unicode/Hindi support)
# fonts-noto: Google Noto fonts (covers Hindi, Devanagari, and other Indic scripts)
# fontconfig: Font configuration library
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libreoffice-writer \
        fonts-liberation \
        fonts-dejavu-core \
        fonts-noto \
        fonts-noto-core \
        fontconfig \
    && fc-cache -fv \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# ── Verify LibreOffice Installation ──────────────────────────────────────────
RUN libreoffice --version && echo "✅ LibreOffice installed successfully"

# ── Set Working Directory ────────────────────────────────────────────────────
WORKDIR /app

# ── Install Node.js Dependencies ─────────────────────────────────────────────
# Copy package files first for better Docker layer caching
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ── Copy Application Code ───────────────────────────────────────────────────
COPY . .

# ── Create uploads directory (for consent templates) ─────────────────────────
RUN mkdir -p /app/uploads/consent-templates

# ── Environment ──────────────────────────────────────────────────────────────
# PORT is set by Render automatically, fallback to 5000
ENV NODE_ENV=production

# ── Start the Application ───────────────────────────────────────────────────
CMD ["npm", "start"]
