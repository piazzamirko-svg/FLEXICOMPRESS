
import { PDFDocument } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';

// Configurazione worker per PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`;

export const generateThumbnail = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ 
    data: arrayBuffer,
    cMapUrl: 'https://esm.sh/pdfjs-dist@4.10.38/cmaps/',
    cMapPacked: true
  });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);
  
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  if (context) {
    await page.render({ canvasContext: context, viewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.85);
  }
  return '';
};

export const compressPdf = async (
  file: File | Blob, 
  level: 'Minima' | 'Media' | 'Massima' | 'Personalizzata'
): Promise<{ blob: Blob; size: number }> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  
  const newPdfDoc = await PDFDocument.create();
  const pages = await newPdfDoc.copyPages(pdfDoc, pdfDoc.getPageIndices());
  pages.forEach(page => newPdfDoc.addPage(page));

  newPdfDoc.setProducer('Flexi Compress Engine');

  const pdfBytes = await newPdfDoc.save({ 
    useObjectStreams: true,
    addDefaultFont: false,
    updateMetadata: false
  });
  
  const finalBlob = new Blob([pdfBytes], { type: 'application/pdf' });
  
  return {
    blob: finalBlob,
    size: finalBlob.size
  };
};

/**
 * Divide un PDF in più parti basandosi sulla dimensione target in MB
 * Utilizza un indice progressivo 001, 002, ecc. per i nomi dei file.
 */
export const splitPdfBySize = async (
  blob: Blob,
  baseName: string,
  targetMb: number
): Promise<{ blob: Blob; name: string; size: number }[]> => {
  const targetBytes = targetMb * 1024 * 1024;
  const arrayBuffer = await blob.arrayBuffer();
  const sourcePdfDoc = await PDFDocument.load(arrayBuffer);
  const pageCount = sourcePdfDoc.getPageCount();
  
  const parts: { blob: Blob; name: string; size: number }[] = [];
  let currentPartDoc = await PDFDocument.create();
  let currentPartIndex = 1;

  for (let i = 0; i < pageCount; i++) {
    // Crea un documento temporaneo per testare il peso della pagina
    const tempDoc = await PDFDocument.create();
    const [page] = await tempDoc.copyPages(sourcePdfDoc, [i]);
    tempDoc.addPage(page);
    const pageBytes = await tempDoc.save({ useObjectStreams: true });

    // Se aggiungendo questa pagina superiamo il limite (e il documento corrente non è vuoto)
    const currentBytes = await currentPartDoc.save({ useObjectStreams: true });
    
    if (currentBytes.length + pageBytes.length > targetBytes && currentPartDoc.getPageCount() > 0) {
      // Salva la parte attuale
      const finalBytes = await currentPartDoc.save({ useObjectStreams: true });
      const finalBlob = new Blob([finalBytes], { type: 'application/pdf' });
      const paddedIndex = currentPartIndex.toString().padStart(3, '0');
      parts.push({
        blob: finalBlob,
        name: `${baseName.replace('.pdf', '')}_${paddedIndex}.pdf`,
        size: finalBlob.size
      });
      
      // Inizia nuova parte
      currentPartDoc = await PDFDocument.create();
      currentPartIndex++;
    }

    const [pageToMove] = await currentPartDoc.copyPages(sourcePdfDoc, [i]);
    currentPartDoc.addPage(pageToMove);
  }

  // Salva l'ultima parte
  if (currentPartDoc.getPageCount() > 0) {
    const finalBytes = await currentPartDoc.save({ useObjectStreams: true });
    const finalBlob = new Blob([finalBytes], { type: 'application/pdf' });
    const paddedIndex = currentPartIndex.toString().padStart(3, '0');
    parts.push({
      blob: finalBlob,
      name: `${baseName.replace('.pdf', '')}_${paddedIndex}.pdf`,
      size: finalBlob.size
    });
  }

  return parts;
};

export const mergePdfs = async (files: File[]): Promise<Blob> => {
  const mergedPdf = await PDFDocument.create();
  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }
  const mergedPdfBytes = await mergedPdf.save({ useObjectStreams: true });
  return new Blob([mergedPdfBytes], { type: 'application/pdf' });
};
