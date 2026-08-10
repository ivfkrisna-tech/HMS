const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execSync } = require('child_process');

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
     * Converts a .docx buffer to a PDF buffer perfectly using MS Word COM Object via PowerShell.
     * Guaranteed to preserve formatting, tables, images, headers and margins.
     * Temporary files are created in OS tmp directory and cleaned up immediately.
     * 
     * @param {Buffer} docxBuffer 
     * @returns {Buffer} pdfBuffer
     */
    static convertToPdf(docxBuffer) {
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
