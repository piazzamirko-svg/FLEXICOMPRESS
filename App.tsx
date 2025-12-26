
import React, { useState, useRef, useEffect } from 'react';
import Layout from './components/Layout';
import { PDFFile, CompressionLevel } from './types';
import { compressPdf, mergePdfs, generateThumbnail, splitPdfBySize } from './services/pdfService';
import { GoogleGenAI } from "@google/genai";
import * as pdfjs from 'pdfjs-dist';

// Configurazione Worker (deve corrispondere alla versione in importmap)
pdfjs.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`;

interface ResultPart {
  blob: Blob;
  name: string;
  size: number;
}

// Componente interno per visualizzare il PDF su Canvas (evita blocco Iframe di Edge)
const PdfCanvasPreview: React.FC<{ file: File; onClose: () => void }> = ({ file, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Gestione Zoom: Renderizziamo ad alta qualità fissa, mostriamo via CSS
  const [currentZoom, setCurrentZoom] = useState(0.6); // Zoom visivo iniziale (60% della risoluzione renderizzata)
  const [originalDimensions, setOriginalDimensions] = useState<{width: number, height: number} | null>(null);

  // Renderizza il PDF una sola volta ad alta risoluzione (Scala 2.0)
  useEffect(() => {
    let isMounted = true;
    const renderHighRes = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const arrayBuffer = await file.arrayBuffer();
        
        const loadingTask = pdfjs.getDocument({ 
          data: arrayBuffer,
          cMapUrl: 'https://esm.sh/pdfjs-dist@4.10.38/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: 'https://esm.sh/pdfjs-dist@4.10.38/standard_fonts/'
        });

        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        
        if (!isMounted) return;

        // Renderizziamo a scala 2.0 per avere dettagli nitidi anche quando si zooma
        const renderScale = 2.0; 
        const viewport = page.getViewport({ scale: renderScale });
        
        const canvas = canvasRef.current;
        if (canvas) {
          const context = canvas.getContext('2d');
          if (context) {
            // Impostiamo le dimensioni fisiche del canvas (Pixel reali)
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            // Salviamo le dimensioni per calcolare l'aspect ratio
            setOriginalDimensions({ width: viewport.width, height: viewport.height });

            await page.render({
              canvasContext: context,
              viewport: viewport
            }).promise;
          }
        }
        setLoading(false);
      } catch (err: any) {
        console.error("Errore rendering PDF:", err);
        if (isMounted) {
          setError(`Impossibile visualizzare l'anteprima. ${err.message || ''}`);
          setLoading(false);
        }
      }
    };

    renderHighRes();
    return () => { isMounted = false; };
  }, [file]);

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentZoom(prev => Math.min(prev + 0.1, 1.5)); // Max zoom
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentZoom(prev => Math.max(prev - 0.1, 0.2)); // Min zoom
  };

  return (
    <div className="absolute top-full left-0 right-0 mt-4 z-50 bg-white rounded-[32px] border border-indigo-100 shadow-2xl p-4 animate-in slide-in-from-top-4 overflow-hidden">
       {loading && (
         <div className="h-[300px] w-full flex flex-col items-center justify-center bg-slate-50 rounded-2xl mb-4 text-slate-400 gap-2">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-[10px] font-bold uppercase">Rendering alta qualità...</span>
         </div>
       )}
       
       {error && (
         <div className="h-[200px] w-full flex items-center justify-center bg-red-50 rounded-2xl mb-4 text-red-500 text-xs font-bold px-6 text-center">
            {error}
         </div>
       )}

       {/* Container con scrollbars automatiche */}
       <div 
         ref={containerRef}
         className={`relative w-full h-[500px] bg-slate-100 rounded-2xl border border-slate-200 mb-4 flex justify-center overflow-auto ${loading || error ? 'hidden' : 'block'}`}
       >
          <div className="min-w-full min-h-full flex items-center justify-center p-8">
            <canvas 
              ref={canvasRef} 
              className="shadow-xl bg-white transition-all duration-200 ease-out"
              style={{
                // Qui avviene la magia dello zoom proporzionato CSS
                width: originalDimensions ? `${originalDimensions.width * currentZoom}px` : 'auto',
                height: originalDimensions ? `${originalDimensions.height * currentZoom}px` : 'auto',
                maxWidth: 'none' // Importante per permettere lo scroll orizzontale
              }}
            />
          </div>
          
          {/* Controlli Zoom Flottanti - Fissi rispetto al contenitore visibile */}
          <div className="sticky bottom-4 inset-x-0 flex justify-center z-10 pointer-events-none">
             <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-2xl shadow-xl text-white border border-white/10 pointer-events-auto">
               <button 
                 onClick={handleZoomOut}
                 className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/20 transition-all active:scale-95"
                 title="Riduci Zoom"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                 </svg>
               </button>
               
               <span className="text-[10px] font-black w-10 text-center select-none tabular-nums">
                 {Math.round(currentZoom * 100)}%
               </span>
               
               <button 
                 onClick={handleZoomIn}
                 className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/20 transition-all active:scale-95"
                 title="Aumenta Zoom"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                 </svg>
               </button>
            </div>
          </div>
       </div>
       
       <button onClick={onClose} className="w-full py-3 bg-slate-100 text-slate-500 font-black text-[10px] uppercase rounded-xl hover:bg-slate-200 transition-all cursor-pointer">
         Chiudi Anteprima
       </button>
    </div>
  );
};

const App: React.FC = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>(CompressionLevel.MEDIUM);
  const [targetMb, setTargetMb] = useState<string>('2.5');
  const [baseFileName, setBaseFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [shouldMerge, setShouldMerge] = useState(false);
  const [customProvider, setCustomProvider] = useState('');
  const [isSearchingLimit, setIsSearchingLimit] = useState(false);
  const [resultParts, setResultParts] = useState<ResultPart[] | null>(null);
  const [originalTotalSize, setOriginalTotalSize] = useState(0);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const emailProviders = [
    { name: 'Gmail', limit: 25 },
    { name: 'Outlook', limit: 20 },
    { name: 'iCloud', limit: 20 },
    { name: 'Yahoo', limit: 25 },
    { name: 'Libero', limit: 25 },
    { name: 'Virgilio', limit: 25 }
  ];

  // Imposta un nome di base suggerito quando vengono caricati i file
  useEffect(() => {
    if (files.length > 0 && !baseFileName) {
      const firstFileName = files[0].name.replace(/\.[^/.]+$/, "");
      setBaseFileName(shouldMerge ? "Documento_Unito" : firstFileName);
    }
  }, [files, shouldMerge, baseFileName]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = Array.from(e.target.files || []);
    const pdfFiles = uploadedFiles.filter(file => file.type === 'application/pdf');
    if (pdfFiles.length === 0) return;

    setIsProcessing(true);
    setProcessingStep('Analisi file...');
    const newPdfFiles: PDFFile[] = await Promise.all(pdfFiles.map(async (file) => {
      // Nota: generateThumbnail è usato solo per l'iconcina piccola, l'anteprima grande ora è live
      const thumbnail = await generateThumbnail(file).catch(() => undefined);
      return {
        id: Math.random().toString(36).substr(2, 9),
        file,
        name: file.name,
        originalSize: file.size,
        status: 'idle',
        previewUrl: URL.createObjectURL(file),
        thumbnail
      };
    }));
    
    setFiles(prev => [...prev, ...newPdfFiles]);
    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const onDragStart = (index: number) => setDraggedIndex(index);
  const onDragEnd = () => setDraggedIndex(null);
  const onDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const newFiles = [...files];
    const item = newFiles[draggedIndex];
    newFiles.splice(draggedIndex, 1);
    newFiles.splice(index, 0, item);
    setDraggedIndex(index);
    setFiles(newFiles);
  };

  const lookupProviderLimit = async () => {
    if (!customProvider.trim()) return;
    setIsSearchingLimit(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Qual è il limite massimo (in MB) per un singolo allegato PDF del provider ${customProvider}? Rispondi solo col numero.`,
        config: { tools: [{ googleSearch: {} }] }
      });
      const match = response.text?.match(/(\d+)/);
      if (match) setTargetMb((parseInt(match[1]) * 0.95).toFixed(1));
    } catch (error) { console.error(error); } finally { setIsSearchingLimit(false); }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const processFiles = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    const totalOriginal = files.reduce((acc, f) => acc + f.originalSize, 0);
    setOriginalTotalSize(totalOriginal);

    const finalBaseName = baseFileName.trim() || (shouldMerge ? "Documento_Unito" : files[0].name.replace(/\.[^/.]+$/, ""));

    try {
      setProcessingStep('Ottimizzazione struttura...');
      let workingBlob: Blob;

      if (shouldMerge && files.length > 1) {
        workingBlob = await mergePdfs(files.map(f => f.file));
      } else {
        workingBlob = files[0].file;
      }

      const compressed = await compressPdf(workingBlob, compressionLevel as any);
      
      const limitBytes = parseFloat(targetMb) * 1024 * 1024;
      
      if (compressionLevel === CompressionLevel.TARGET && compressed.size > limitBytes) {
        setProcessingStep('Suddivisione in parti sicure...');
        const parts = await splitPdfBySize(compressed.blob, finalBaseName, parseFloat(targetMb));
        setResultParts(parts);
      } else {
        setResultParts([{
          blob: compressed.blob,
          name: `${finalBaseName}.pdf`,
          size: compressed.size
        }]);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const downloadAll = () => {
    resultParts?.forEach((part, index) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(part.blob);
        link.download = part.name;
        link.click();
      }, index * 400);
    });
  };

  const reset = () => {
    setFiles([]);
    setResultParts(null);
    setPreviewId(null);
    setBaseFileName('');
  };

  return (
    <Layout>
      <div className="blob -top-20 -left-20 animate-float"></div>
      <div className="blob top-1/2 -right-20 animate-float" style={{animationDelay: '2s'}}></div>

      {/* Hidden Global File Input - Explicit style to ensure it exists in DOM but invisible */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept=".pdf" 
        multiple 
        style={{ display: 'none' }}
      />

      <div className="max-w-4xl mx-auto space-y-12 relative z-10">
        
        <div className="text-center space-y-6 animate-in fade-in slide-in-from-top-4 duration-1000">
          <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter leading-[1.0]">
            Oltre ogni <br />
            <span className="gradient-text">Limite Email</span>
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto font-medium leading-relaxed">
            Se il PDF è troppo grande, Flexi lo divide automaticamente in parti sicure per i tuoi allegati. 
            Creato da <strong>Mirko Piazza</strong> per invii senza errori.
          </p>
        </div>

        <div className="relative group transition-all duration-700">
          <div className="absolute -inset-2 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 rounded-[40px] blur-2xl opacity-50 group-hover:opacity-100 transition duration-1000"></div>
          
          <div className="relative bg-white/95 rounded-[38px] shadow-2xl border border-white overflow-hidden glass">
            
            {files.length === 0 && !resultParts ? (
              <div 
                onClick={triggerFileInput}
                className="p-16 md:p-24 flex flex-col items-center justify-center space-y-8 cursor-pointer group/upload"
              >
                <div className="w-28 h-28 bg-slate-50 rounded-[36px] flex items-center justify-center text-slate-300 group-hover/upload:bg-indigo-600 group-hover/upload:text-white transition-all duration-500 shadow-inner pulse-border">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <p className="text-2xl font-black text-slate-900">Carica i PDF da ottimizzare</p>
              </div>
            ) : resultParts ? (
              /* Multi-Part Download View */
              <div className="p-10 md:p-14 space-y-10 animate-in zoom-in-95 duration-700 text-center">
                <div className="space-y-6">
                   <div className="inline-block px-6 py-2 bg-green-500/10 text-green-600 rounded-full border border-green-500/20 text-xs font-black uppercase tracking-widest">
                      {resultParts.length > 1 ? `Generati ${resultParts.length} file progressivi` : 'Ottimizzazione completata'}
                   </div>
                   <h3 className="text-4xl font-black text-slate-900 tracking-tighter">Documenti pronti per l'invio</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                   {resultParts.map((part, idx) => (
                     <div key={idx} className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-xl transition-all">
                        <div className="text-left overflow-hidden">
                           <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">Parte {idx + 1}</p>
                           <p className="text-sm font-bold text-slate-900 truncate pr-4">{part.name}</p>
                           <p className="text-[10px] font-bold text-slate-400 mt-1">{formatSize(part.size)}</p>
                        </div>
                        <a 
                          href={URL.createObjectURL(part.blob)} download={part.name}
                          className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-slate-100 hover:bg-indigo-600 hover:text-white transition-all"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </a>
                     </div>
                   ))}
                </div>
                
                <div className="flex flex-col md:flex-row gap-4 justify-center items-center pt-6">
                  {resultParts.length > 1 && (
                    <button 
                      onClick={downloadAll}
                      className="animate-shine px-12 py-6 bg-slate-900 text-white rounded-[28px] font-black text-xl hover:bg-black transition-all shadow-xl"
                    >
                      Scarica Tutto
                    </button>
                  )}
                  <button onClick={reset} className="px-8 py-4 text-slate-400 font-black uppercase tracking-widest text-[11px] hover:text-indigo-600 transition-all">Nuova Coda</button>
                </div>
              </div>
            ) : (
              <div className="p-8 md:p-12 space-y-10">
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <label className="text-sm font-black uppercase tracking-widest text-slate-900 tracking-tighter">I Tuoi File ({files.length})</label>
                    <button type="button" onClick={triggerFileInput} className="text-indigo-600 font-black text-xs uppercase hover:bg-indigo-50 px-3 py-1 rounded-lg transition-all cursor-pointer">+ Aggiungi</button>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {files.map((file, idx) => (
                      <div 
                        key={file.id} 
                        draggable onDragStart={() => onDragStart(idx)} onDragOver={(e) => onDragOver(e, idx)} onDragEnd={onDragEnd}
                        className={`group relative flex items-center gap-4 p-4 bg-slate-50/50 hover:bg-white rounded-3xl border border-slate-100 hover:border-indigo-200 transition-all cursor-move ${draggedIndex === idx ? 'opacity-40' : ''}`}
                      >
                        <div className="relative w-14 h-18 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0">
                          {file.thumbnail ? <img src={file.thumbnail} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300">...</div>}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                             <button onClick={(e) => { e.stopPropagation(); setPreviewId(previewId === file.id ? null : file.id); }} className="opacity-0 group-hover:opacity-100 bg-white p-2 rounded-full shadow-lg">
                               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                               </svg>
                             </button>
                          </div>
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <h4 className="text-sm font-black text-slate-900 truncate tracking-tight">{file.name}</h4>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formatSize(file.originalSize)}</span>
                        </div>
                        <button onClick={() => removeFile(file.id)} className="p-3 text-slate-300 hover:text-red-500 transition-all">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        
                        {previewId === file.id && (
                          <PdfCanvasPreview file={file.file} onClose={() => setPreviewId(null)} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {files.length > 1 && (
                  <div className="flex items-center justify-between p-7 bg-indigo-600 rounded-[32px] text-white shadow-lg">
                    <div className="flex items-center gap-5">
                      <p className="text-base font-black tracking-tight leading-none">Unisci i PDF</p>
                    </div>
                    <button onClick={() => setShouldMerge(!shouldMerge)} className={`relative w-16 h-8 rounded-full transition-all border-2 border-white/20 ${shouldMerge ? 'bg-white' : 'bg-indigo-800'}`}>
                      <div className={`absolute top-1 left-1 w-5 h-5 rounded-full transition-transform ${shouldMerge ? 'translate-x-8 bg-indigo-600' : 'translate-x-0 bg-white'}`}></div>
                    </button>
                  </div>
                )}

                <div className="space-y-10 pt-4">
                  {/* File Naming Section */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center ml-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Nome File Finale (Senza estensione)</label>
                       <span className="text-[9px] font-bold text-indigo-400 bg-indigo-50 px-2 py-0.5 rounded">Obbligatorio</span>
                    </div>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={baseFileName} 
                        onChange={(e) => setBaseFileName(e.target.value)} 
                        placeholder="Es: MioDocumento_Firmato"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl px-6 py-5 text-slate-900 font-bold outline-none focus:border-indigo-600 focus:bg-white transition-all pr-16 shadow-inner"
                      />
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 uppercase">.pdf</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.values(CompressionLevel).map((level) => (
                      <button
                        key={level} onClick={() => setCompressionLevel(level)}
                        className={`py-6 rounded-[28px] border-2 transition-all font-black text-xs uppercase tracking-widest ${
                          compressionLevel === level ? 'border-indigo-600 bg-indigo-600 text-white shadow-xl scale-[1.04]' : 'border-slate-50 bg-slate-50 text-slate-400'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>

                  {compressionLevel === CompressionLevel.TARGET && (
                    <div className="bg-slate-950 rounded-[44px] p-8 md:p-10 space-y-8 text-white animate-in zoom-in-95 shadow-2xl">
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                        {emailProviders.map(p => (
                          <button key={p.name} onClick={() => setTargetMb((p.limit * 0.95).toFixed(1))} className="py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-indigo-600 transition-all">
                             <span className="text-[9px] font-black uppercase block opacity-50">{p.name}</span>
                             <span className="text-xs font-black text-indigo-400">{p.limit}MB</span>
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-3">
                        <input type="text" value={customProvider} onChange={e => setCustomProvider(e.target.value)} placeholder="Provider (es: PEC Aruba...)" className="flex-1 bg-slate-900 border-2 border-slate-800 rounded-2xl px-5 py-4 text-white text-sm outline-none focus:border-indigo-600" />
                        <button onClick={lookupProviderLimit} disabled={isSearchingLimit} className="bg-indigo-600 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50">{isSearchingLimit ? "..." : "IA"}</button>
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-end">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Limite Allegato</span>
                          <span className="text-4xl font-black text-white">{targetMb} MB</span>
                        </div>
                        <input type="range" min="0.5" max="50" step="0.5" value={targetMb} onChange={e => setTargetMb(e.target.value)} className="w-full accent-indigo-500" />
                      </div>
                      <p className="text-[10px] text-slate-500 italic">Se il file compresso supera questo limite, verrà diviso in più parti (001, 002, ecc.).</p>
                    </div>
                  )}

                  <button 
                    onClick={processFiles} disabled={isProcessing || files.length === 0}
                    className="relative w-full py-9 bg-indigo-600 text-white rounded-[36px] font-black text-3xl hover:bg-indigo-700 transition-all shadow-2xl flex items-center justify-center gap-6 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? (
                      <div className="flex flex-col items-center">
                         <div className="flex items-center gap-3">
                           <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                           <span>Lavoro in corso...</span>
                         </div>
                         <span className="text-[10px] font-black uppercase tracking-[0.2em] mt-2 opacity-60">{processingStep}</span>
                      </div>
                    ) : (
                      <>
                        <span>Ottimizza ed Esporta</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default App;
