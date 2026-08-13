const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execSync, exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

/**
 * Service to handle dynamic placeholder replacement in .docx files.
 */
class ConsentFillerService {
    /**
     * Reads a .docx template, replaces placeholders with provided data,
     * and returns the generated document as a buffer.
     *
     * @param {string} templatePath - Absolute path to the original .docx template
     * @param {Object} data - Dictionary of placeholder keys and values
     * @returns {Buffer} The generated .docx file buffer
     */
    static generateFilledDocument(templatePath, data) {
        try {
            // Load the docx file as binary content
            const content = fs.readFileSync(templatePath, 'binary');

            // Load the binary content into PizZip
            const zip = new PizZip(content);
            
            // Clean up newlines in data to avoid creating manual line breaks
            // Docxtemplater natively handles special XML characters escaping.
            const cleanedData = {};
            Object.keys(data).forEach(key => {
                let value = data[key] || '';
                // Replace any newlines with space to prevent manual linebreaks/new paragraphs
                cleanedData[key] = String(value).replace(/[\r\n]+/g, ' ').trim();
            });

            // Initialize Docxtemplater
            // We use {{ and }} as delimiters since the system historically used them
            const doc = new Docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: false, 
                delimiters: { start: '{{', end: '}}' },
                nullGetter: () => { return ""; } // Replace undefined variables with empty string
            });

            // Render the document (replace placeholders dynamically)
            // Docxtemplater natively preserves paragraph formatting, text runs, and spacing
            doc.render(cleanedData);

            // Generate the output buffer
            const buffer = doc.getZip().generate({
                type: 'nodebuffer',
                compression: 'DEFLATE',
            });

            return buffer;
        } catch (error) {
            console.error('Error generating filled consent document:', error);
            // Docxtemplater provides detailed error logs
            if (error.properties && error.properties.errors instanceof Array) {
                const errorMessages = error.properties.errors.map(function (error) {
                    return error.properties.explanation;
                }).join("\n");
                console.error('Docxtemplater errors:', errorMessages);
            }
            throw new Error(`Failed to generate document: ${error.message}`);
        }
    }

    /**
     * Checks if LibreOffice is available on the system.
     * Called once at server startup for health verification.
     * @returns {{ available: boolean, path: string, version: string }}
     */
    static checkLibreOffice() {
        const binaryNames = ['libreoffice', 'soffice'];
        for (const bin of binaryNames) {
            try {
                const versionOutput = execSync(`${bin} --version`, { stdio: 'pipe', timeout: 10000 }).toString().trim();
                console.log(`[LibreOffice Check] ✅ LibreOffice detected successfully`);
                console.log(`[LibreOffice Check] Binary: ${bin}`);
                console.log(`[LibreOffice Check] Version: ${versionOutput}`);
                return { available: true, path: bin, version: versionOutput };
            } catch (e) {
                // Try next binary name
            }
        }
        console.log(`[LibreOffice Check] ⚠️ LibreOffice not found on this system. PDF conversion will use Windows MS Word fallback.`);
        return { available: false, path: null, version: null };
    }

    /**
     * Converts a .docx buffer to a PDF buffer.
     * 
     * On Linux/Docker: Uses LibreOffice headless CLI (libreoffice --headless --convert-to pdf)
     * On Windows: Uses MS Word COM Object via PowerShell (existing local dev behavior)
     * 
     * Temporary files are created in OS tmp directory and cleaned up immediately.
     * 
     * @param {Buffer} docxBuffer - The filled .docx document as a buffer
     * @returns {Promise<Buffer>} The generated PDF as a buffer
     */
    static async convertToPdf(docxBuffer) {
        const isWindows = os.platform() === 'win32';

        if (!isWindows) {
            return await ConsentFillerService._convertWithLibreOffice(docxBuffer);
        } else {
            return ConsentFillerService._convertWithMSWord(docxBuffer);
        }
    }

    /**
     * Linux/Docker conversion using LibreOffice headless CLI.
     * Command: libreoffice --headless --convert-to pdf --outdir <tempDir> <docxFile>
     * 
     * @param {Buffer} docxBuffer
     * @returns {Promise<Buffer>} pdfBuffer
     */
    static async _convertWithLibreOffice(docxBuffer) {
        const tempId = crypto.randomUUID();
        const tempDir = path.join(os.tmpdir(), `consent-pdf-${tempId}`);
        const docxPath = path.join(tempDir, `${tempId}.docx`);

        // The PDF output will have the same basename but .pdf extension
        const pdfPath = path.join(tempDir, `${tempId}.pdf`);

        try {
            // Create temp directory
            fs.mkdirSync(tempDir, { recursive: true });

            // Write the .docx buffer to a temporary file
            fs.writeFileSync(docxPath, docxBuffer);
            console.log(`[PDF Gen] Linux: Written temp DOCX to ${docxPath} (${docxBuffer.length} bytes)`);

            // Determine the LibreOffice binary
            let libreBin = 'libreoffice';
            try {
                execSync('which soffice', { stdio: 'pipe' });
                libreBin = 'soffice';
            } catch (e) {
                try {
                    execSync('which libreoffice', { stdio: 'pipe' });
                    libreBin = 'libreoffice';
                } catch (e2) {
                    throw new Error('LibreOffice is not installed. Neither "libreoffice" nor "soffice" found in PATH.');
                }
            }

            // Run LibreOffice headless conversion
            const cmd = `${libreBin} --headless --norestore --safe-mode --convert-to pdf --outdir "${tempDir}" "${docxPath}"`;
            console.log(`[PDF Gen] Linux: Executing: ${cmd}`);

            try {
                const { stdout, stderr } = await execAsync(cmd, {
                    timeout: 60000, // 60 second timeout
                    env: {
                        ...process.env,
                        HOME: os.tmpdir(), // LibreOffice needs a writable HOME
                    }
                });
                if (stdout) console.log(`[PDF Gen] Linux LibreOffice stdout: ${stdout.trim()}`);
                if (stderr) console.warn(`[PDF Gen] Linux LibreOffice stderr: ${stderr.trim()}`);
            } catch (execErr) {
                const stdoutStr = execErr.stdout ? execErr.stdout.toString() : '';
                const stderrStr = execErr.stderr ? execErr.stderr.toString() : '';
                console.error(`[PDF Gen] LibreOffice exec failed:`, execErr.message);
                console.error(`[PDF Gen] stdout: ${stdoutStr}`);
                console.error(`[PDF Gen] stderr: ${stderrStr}`);
                throw new Error(`LibreOffice conversion failed: ${stderrStr || execErr.message}`);
            }

            // Verify the PDF was created
            if (!fs.existsSync(pdfPath)) {
                // Sometimes LibreOffice uses a slightly different output name, check for any .pdf in tempDir
                const files = fs.readdirSync(tempDir).filter(f => f.endsWith('.pdf'));
                if (files.length === 0) {
                    throw new Error('LibreOffice did not produce a PDF file.');
                }
                // Use the first PDF found
                const actualPdfPath = path.join(tempDir, files[0]);
                console.log(`[PDF Gen] Linux: PDF found at alternate path: ${actualPdfPath}`);
                const pdfBuffer = fs.readFileSync(actualPdfPath);
                console.log(`[PDF Gen] Linux: PDF generated successfully (${pdfBuffer.length} bytes)`);
                return pdfBuffer;
            }

            const pdfBuffer = fs.readFileSync(pdfPath);
            console.log(`[PDF Gen] Linux: PDF generated successfully (${pdfBuffer.length} bytes)`);
            return pdfBuffer;

        } catch (error) {
            console.error('[PDF Gen] Linux conversion error:', error);
            throw new Error(`Failed to convert document to PDF: ${error.message}`);
        } finally {
            // Cleanup entire temp directory
            try {
                if (fs.existsSync(tempDir)) {
                    fs.rmSync(tempDir, { recursive: true, force: true });
                    console.log(`[PDF Gen] Linux: Cleaned up temp directory ${tempDir}`);
                }
            } catch (cleanErr) {
                console.warn(`[PDF Gen] Linux: Cleanup warning: ${cleanErr.message}`);
            }
        }
    }

    /**
     * Windows conversion using MS Word COM Object via PowerShell.
     * Preserves existing local development behavior exactly.
     * 
     * @param {Buffer} docxBuffer
     * @returns {Buffer} pdfBuffer
     */
    static _convertWithMSWord(docxBuffer) {
        console.log('[PDF Gen] Windows environment detected. Using MS Word COM Object...');
        const tempId = crypto.randomUUID();
        const docxPath = path.join(os.tmpdir(), `${tempId}.docx`);
        const pdfPath = path.join(os.tmpdir(), `${tempId}.pdf`);
        const scriptPath = path.join(os.tmpdir(), `${tempId}.ps1`);

        try {
            // Write the buffer to a temporary .docx file
            fs.writeFileSync(docxPath, docxBuffer);

            // PowerShell script to convert via Word.Application COM Object
            const psScript = `
param([string]$in, [string]$out)
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 'wdAlertsNone'
    $doc = $word.Documents.Open($in, $false, $true)
    $doc.SaveAs([ref]$out, [ref]17)
    $doc.Close($false)
    $word.Quit($false)
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
    Remove-Variable word
    [gc]::collect()
    [gc]::WaitForPendingFinalizers()
} catch {
    Write-Error $_.Exception.Message
    if ($word) { $word.Quit($false) }
    exit 1
}
`;
            fs.writeFileSync(scriptPath, psScript);

            // Execute the script
            try {
                execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -in "${docxPath}" -out "${pdfPath}"`, {
                    stdio: 'pipe'
                });
            } catch (execErr) {
                const stdoutStr = execErr.stdout ? execErr.stdout.toString() : '';
                const stderrStr = execErr.stderr ? execErr.stderr.toString() : '';
                console.error(`PowerShell Exec Error: ${execErr.message}`);
                console.error(`PS STDOUT: ${stdoutStr}`);
                console.error(`PS STDERR: ${stderrStr}`);
                throw new Error(`PowerShell script failed: ${stderrStr || execErr.message}`);
            }

            // Read the generated PDF
            if (!fs.existsSync(pdfPath)) {
                throw new Error("PDF file was not created by the conversion process.");
            }
            const pdfBuffer = fs.readFileSync(pdfPath);
            return pdfBuffer;

        } catch (error) {
            console.error('Error converting docx to pdf:', error);
            throw new Error('Failed to convert document to PDF.');
        } finally {
            // Cleanup temp files
            if (fs.existsSync(docxPath)) {
                try { fs.unlinkSync(docxPath); } catch(e) {}
            }
            if (fs.existsSync(pdfPath)) {
                try { fs.unlinkSync(pdfPath); } catch(e) {}
            }
            if (fs.existsSync(scriptPath)) {
                try { fs.unlinkSync(scriptPath); } catch(e) {}
            }
        }
    }
}

module.exports = ConsentFillerService;
