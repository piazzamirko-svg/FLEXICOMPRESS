
export interface PDFFile {
  file: File;
  id: string;
  name: string;
  originalSize: number;
  compressedSize?: number;
  status: 'idle' | 'processing' | 'completed' | 'error';
  previewUrl?: string;
  thumbnail?: string; // Base64 image of the first page
}

export enum CompressionLevel {
  LOW = 'Minima',
  MEDIUM = 'Media',
  HIGH = 'Massima',
  TARGET = 'Personalizzata'
}
