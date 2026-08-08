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
            
            // Get the raw XML
            let xml = zip.file("word/document.xml").asText();
            
            // 1. Remove proofErr tags that corrupt XML token boundaries
            let cleaned = xml.replace(/<w:proofErr[^>]*\/>/g, '');
            cleaned = cleaned.replace(/<w:proofErr[^>]*>.*?<\/w:proofErr>/g, '');
            
            // 2. Uncorrupt split tags inside {{ and }}
            let uncorruptedXml = '';
            let inBraces = 0;
            for (let i = 0; i < cleaned.length; i++) {
                let char = cleaned[i];
                if (char === '{') {
                    inBraces++;
                    uncorruptedXml += char;
                } else if (char === '}') {
                    if (inBraces > 0) inBraces--;
                    uncorruptedXml += char;
                } else if (char === '<' && inBraces > 0) {
                    // Skip internal XML tags between braces
                    let tag = '<';
                    i++;
                    while (i < cleaned.length && cleaned[i] !== '>') {
                        tag += cleaned[i];
                        i++;
                    }
                    tag += '>';
                } else {
                    uncorruptedXml += char;
                }
            }

            // 3. Replace all placeholders dynamically
            Object.keys(data).forEach(key => {
                let value = data[key] || '';
                // Escape special XML characters in value
                value = String(value)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&apos;');
                    
                const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
                uncorruptedXml = uncorruptedXml.replace(regex, value);
            });
            
            // 4. Also clear any remaining unfilled placeholders to avoid raw {{ }} in final doc
            uncorruptedXml = uncorruptedXml.replace(/\{\{[^}]+\}\}/g, '');

            // 5. Update the zip with the filled XML
            zip.file("word/document.xml", uncorruptedXml);

            // Generate the output buffer
            const buffer = zip.generate({
                type: 'nodebuffer',
                compression: 'DEFLATE',
            });

            return buffer;
        } catch (error) {
            console.error('Error generating filled consent document:', error);
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
