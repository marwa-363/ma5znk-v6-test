import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { translations } from '../translations';
import { X, Camera } from 'lucide-react';
import Button from './Button';

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  lang: 'ar' | 'en';
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose, lang }) => {
  const t = translations[lang];
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const config = {
      fps: 10,
      qrbox: { width: 250, height: 150 },
      aspectRatio: 1.0,
    };

    scannerRef.current = new Html5QrcodeScanner(
      "reader",
      config,
      /* verbose= */ false
    );

    scannerRef.current.render(
      (decodedText) => {
        onScan(decodedText);
        if (scannerRef.current) {
          scannerRef.current.clear();
        }
        onClose();
      },
      (errorMessage) => {
        // Silently ignore scan errors as they happen frequently during scanning
      }
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Failed to clear scanner", err));
      }
    };
  }, [onScan, onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-lg">{t.scanBarcode}</h3>
          </div>
          <Button 
            onClick={onClose}
            variant="secondary"
            size="sm"
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors bg-transparent border-none"
            leftIcon={<X className="w-6 h-6" />}
          />
        </div>
        
        <div className="p-4">
          <div id="reader" className="overflow-hidden rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700"></div>
          {error && (
            <p className="mt-4 text-center text-red-500 font-medium">{error}</p>
          )}
        </div>
        
        <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {lang === 'ar' ? 'وجه الكاميرا نحو الباركود' : 'Point the camera at the barcode'}
          </p>
        </div>
      </div>
    </div>
  );
};
