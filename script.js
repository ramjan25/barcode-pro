document.addEventListener('DOMContentLoaded', () => {
    // --- Library Checks ---
    const libs = { JsBarcode, jsPDF: window.jspdf, JSZip };
    for (const libName in libs) {
        if (typeof libs[libName] === 'undefined') {
            console.error(`${libName} library is not loaded.`);
            alert(`A critical library (${libName}) failed to load. Please refresh the page.`);
            return;
        }
    }

    // --- DOM Element References ---
    const getEl = (id) => document.getElementById(id);
    const elements = {
        prefix: getEl('prefix'),
        startVal: getEl('start-val'),
        endVal: getEl('end-val'),
        suffix: getEl('suffix'),
        increment: getEl('increment'),
        pageWidth: getEl('page-width'),
        pageHeight: getEl('page-height'),
        barcodeWidth: getEl('barcode-width'),
        barcodeHeight: getEl('barcode-height'),
        moveX: getEl('move-x'),
        moveY: getEl('move-y'),
        gapHorizontal: getEl('gap-horizontal'),
        gapVertical: getEl('gap-vertical'),
        previewCanvas: getEl('preview-canvas'),
        manualData: getEl('manual-data'),
        processTextInput: getEl('process-text-input'),
    };

    // --- Event Listeners ---
    getEl('generate-preview-btn').addEventListener('click', handlePreview);
    getEl('export-pdf-btn').addEventListener('click', handleStandardPdfExport);
    getEl('export-united-pdf-btn').addEventListener('click', handleUnitedPdfExport);
    getEl('export-svg-btn').addEventListener('click', handleSvgZipExport);
    getEl('process-text-btn').addEventListener('click', handleProcessText);

    // --- Functions ---

    const generateBarcodeData = () => {
        const { prefix, startVal, endVal, suffix, increment } = elements;
        const start = parseInt(startVal.value, 10);
        const end = parseInt(endVal.value, 10);
        const inc = parseInt(increment.value, 10) || 1;

        if (isNaN(start) || isNaN(end) || isNaN(inc)) {
            alert('Please ensure Start, End, and Increment are valid numbers.');
            return [];
        }

        const codes = [];
        for (let i = start; i <= end; i += inc) {
            codes.push(`${prefix.value}${i}${suffix.value}`);
        }
        return codes;
    };

    const getCodesFromManualEntry = () => {
        return elements.manualData.value.split('\n').map(s => s.trim()).filter(Boolean);
    };

    function handlePreview() {
        const codes = generateBarcodeData();
        const { previewCanvas } = elements;
        previewCanvas.innerHTML = '';
        if (codes.length === 0) {
            previewCanvas.innerHTML = '<p class="placeholder-text">No data to preview.</p>';
            return;
        }
        codes.slice(0, 10).forEach(code => {
            const item = document.createElement('div');
            item.className = 'preview-item';
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            item.appendChild(svg);
            previewCanvas.appendChild(item);
            try {
                JsBarcode(svg, code, { format: 'CODE128', displayValue: true, fontSize: 16, textMargin: 0 });
            } catch (e) {
                console.error(`Failed to generate barcode for "${code}":`, e);
                item.innerHTML = `<p style="color: red;">Invalid code: ${code}</p>`;
            }
        });
    }

    async function handleStandardPdfExport() {
        const codes = generateBarcodeData();
        if (codes.length === 0) return alert('No barcodes to export.');

        const { pageWidth, pageHeight, barcodeWidth, barcodeHeight, moveX, moveY, gapHorizontal, gapVertical } = elements;
        const pW = parseFloat(pageWidth.value) * 72;
        const pH = parseFloat(pageHeight.value) * 72;
        const bW = parseFloat(barcodeWidth.value);
        const bH = parseFloat(barcodeHeight.value);
        const mX = parseFloat(moveX.value) * 72;
        const mY = parseFloat(moveY.value) * 72;
        const gH = parseFloat(gapHorizontal.value);
        const gV = parseFloat(gapVertical.value);

        if ([pW, pH, bW, bH, mX, mY, gH, gV].some(isNaN)) {
            return alert('Please ensure all layout settings are valid numbers.');
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: pW > pH ? 'landscape' : 'portrait', unit: 'pt', format: [pW, pH] });

        for (let i = 0; i < codes.length; i += 3) {
            if (i > 0) doc.addPage();
            const rowCodes = codes.slice(i, i + 3);
            for (let j = 0; j < rowCodes.length; j++) {
                const code = rowCodes[j];
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                JsBarcode(svg, code, { format: 'CODE128', displayValue: false, margin: 0 });

                const x = mX + j * gH;
                const topY = pH - mY - bH - 15;
                const bottomY = topY - gV;

                await doc.svg(svg, { x, y: topY, width: bW, height: bH });
                await doc.svg(svg, { x, y: bottomY, width: bW, height: bH });

                const textX = x + (bW / 2);
                doc.setFontSize(9).text(code, textX, topY + bH + 10, { align: 'center' });
                doc.text(code, textX, bottomY + bH + 10, { align: 'center' });
            }
        }
        doc.save(`barcodes-standard-${Date.now()}.pdf`);
    }

    async function handleUnitedPdfExport() {
        const codes = getCodesFromManualEntry();
        if (codes.length === 0) return alert('Please enter barcode data for PDF export.');

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
        const margin = 72;
        const barcodesPerPage = 20;
        const numPages = Math.ceil(codes.length / barcodesPerPage);

        for (let p = 0; p < numPages; p++) {
            if (p > 0) doc.addPage();
            const pageCodes = codes.slice(p * barcodesPerPage, (p + 1) * barcodesPerPage);
            const effectivePageWidth = doc.internal.pageSize.getWidth() - 2 * margin;
            const effectivePageHeight = doc.internal.pageSize.getHeight() - 2 * margin;
            const colWidth = effectivePageWidth / 4;
            const rowHeight = effectivePageHeight / 5;
            const barcodeWidth = colWidth * 0.8;
            const barcodeHeight = rowHeight * 0.5;

            pageCodes.forEach((code, i) => {
                const row = Math.floor(i / 4);
                const col = i % 4;
                const x = margin + col * colWidth + (colWidth - barcodeWidth) / 2;
                const y = margin + row * rowHeight + (rowHeight - barcodeHeight) / 2;
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                JsBarcode(svg, code, { format: 'CODE128', displayValue: true, fontSize: 10, textMargin: 0, width: 2, height: 50, margin: 10 });
                doc.svg(svg, { x, y, width: barcodeWidth, height: barcodeHeight });
            });
        }
        doc.save(`barcodes-manual-${Date.now()}.pdf`);
    }

    async function handleSvgZipExport() {
        const codes = getCodesFromManualEntry();
        if (codes.length === 0) return alert('Please enter barcode data for SVG export.');

        const zip = new JSZip();
        const serializer = new XMLSerializer();

        codes.forEach(code => {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            try {
                JsBarcode(svg, code, { format: 'CODE128', displayValue: true, xmlDocument: true });
                const svgString = serializer.serializeToString(svg);
                // Sanitize filename
                const safeFilename = code.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                zip.file(`${safeFilename}.svg`, svgString);
            } catch (e) {
                console.warn(`Could not generate barcode for "${code}", skipping.`);
            }
        });

        try {
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            link.download = `barcodes-svg-${Date.now()}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        } catch (error) {
            console.error('Error creating ZIP file:', error);
            alert('Failed to create ZIP file. See console for details.');
        }
    }

    function handleProcessText() {
        const { processTextInput, manualData } = elements;
        const inputText = processTextInput.value.trim();
        if (!inputText) return alert('Please enter processing parameters.');

        const params = inputText.split('\n').reduce((acc, line) => {
            const [key, ...valueParts] = line.split(':');
            if (key && valueParts.length > 0) {
                acc[key.trim().toLowerCase()] = valueParts.join(':').trim();
            }
            return acc;
        }, {});

        const prefix = params.prefix || '';
        const suffix = params.suffix || '';
        const range = params.range ? params.range.split('-').map(Number) : [];
        const increment = params.increment ? parseInt(params.increment, 10) : 1;
        const padding = params.padding ? parseInt(params.padding, 10) : 0;

        if (range.length !== 2 || isNaN(range[0]) || isNaN(range[1])) {
            return alert('Invalid range. Please use the format: range: 1-100');
        }
        const [start, end] = range;

        if (start > end) {
            return alert('Start of range cannot be greater than end.');
        }
        if (isNaN(increment) || increment < 1) {
            return alert('Increment must be a positive number.');
        }
        if (isNaN(padding) || padding < 0) {
            return alert('Padding must be a non-negative number.');
        }

        const generatedCodes = [];
        for (let i = start; i <= end; i += increment) {
            let numberPart = String(i);
            if (padding > 0) {
                numberPart = numberPart.padStart(padding, '0');
            }
            generatedCodes.push(`${prefix}${numberPart}${suffix}`);
        }

        const existingData = manualData.value.trim();
        manualData.value = (existingData ? existingData + '\n' : '') + generatedCodes.join('\n');
        processTextInput.value = ''; // Clear on success
    }
});