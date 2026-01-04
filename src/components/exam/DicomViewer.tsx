import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// Cornerstone stack (legacy) - simplest path for local .dcm rendering
// Note: packages ship without TS types in many setups.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import cornerstone from "cornerstone-core";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import dicomParser from "dicom-parser";
// Use the *NoWebWorkers* bundle to avoid worker/codec path issues in Vite.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import cornerstoneWADOImageLoader from "cornerstone-wado-image-loader/dist/cornerstoneWADOImageLoaderNoWebWorkers.bundle.min.js";

import { X, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DicomViewerProps {
  file: File;
  onClose: () => void;
  onCapture?: (jpg: File) => void;
}

let isCornerstoneConfigured = false;
function ensureCornerstoneConfigured() {
  if (isCornerstoneConfigured) return;

  // Wire externals
  cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
  cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

  // Optional: configure loader defaults
  cornerstoneWADOImageLoader.configure({
    useWebWorkers: false,
  });

  isCornerstoneConfigured = true;
}

function getBaseName(fileName: string) {
  const clean = fileName.replace(/\.[^/.]+$/, "");
  return clean || "dicom";
}

export function DicomViewer({ file, onClose, onCapture }: DicomViewerProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const captureFileName = useMemo(() => {
    const base = getBaseName(file.name);
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
    return `${base}-frame-${stamp}.jpg`;
  }, [file.name]);

  useEffect(() => {
    if (!elementRef.current) return;

    ensureCornerstoneConfigured();

    const element = elementRef.current;

    setIsLoading(true);
    setIsReady(false);
    setError(null);

    try {
      cornerstone.enable(element);

      // Local file -> imageId
      const imageId: string = cornerstoneWADOImageLoader.wadouri.fileManager.add(file);

      cornerstone
        .loadImage(imageId)
        .then((image: any) => {
          cornerstone.displayImage(element, image);
          setIsReady(true);
        })
        .catch((err: any) => {
          console.error("Cornerstone loadImage error:", err);
          setError(err?.message || String(err) || "Falha ao renderizar DICOM");
        })
        .finally(() => {
          setIsLoading(false);
        });
    } catch (e: any) {
      console.error("Cornerstone init error:", e);
      setError(e?.message || String(e) || "Falha ao inicializar visualizador");
      setIsLoading(false);
    }

    return () => {
      try {
        cornerstone.disable(element);
      } catch {
        // ignore
      }
    };
  }, [file]);

  const handleCapture = useCallback(async () => {
    if (!elementRef.current) return;

    const canvas = elementRef.current.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) {
      setError("Não foi possível capturar: canvas não encontrado.");
      return;
    }

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92)
    );

    if (!blob) {
      setError("Não foi possível capturar: falha ao gerar JPG.");
      return;
    }

    const jpgFile = new File([blob], captureFileName, { type: "image/jpeg" });
    onCapture?.(jpgFile);
  }, [captureFileName, onCapture]);

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-foreground truncate max-w-[70%]">
            Visualizador DICOM (simples) - {file.name}
          </h3>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-destructive hover:text-destructive"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Viewer */}
        <div className="p-4">
          <div className="relative rounded-lg overflow-hidden border border-border bg-muted">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="h-10 w-10 rounded-full border-2 border-border border-t-cta animate-spin mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Carregando DICOM...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="bg-card border border-border rounded-lg p-4 text-center max-w-lg">
                  <p className="font-medium text-destructive mb-1">Falha ao ler DICOM</p>
                  <p className="text-sm text-muted-foreground break-words">{error}</p>
                </div>
              </div>
            )}

            <div
              ref={elementRef}
              className="w-full h-[520px]"
              aria-label="Área de renderização do DICOM"
            />
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              <Maximize2 className="w-3 h-3 inline mr-1" />
              Dica: use o scroll para zoom e arraste para mover.
            </p>

            <Button
              className="btn-cta"
              onClick={handleCapture}
              disabled={!isReady}
            >
              Capturar Imagem
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
