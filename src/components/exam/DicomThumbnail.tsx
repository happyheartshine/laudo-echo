import { useEffect, useRef, useState } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import cornerstone from "cornerstone-core";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import dicomParser from "dicom-parser";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import cornerstoneWADOImageLoader from "cornerstone-wado-image-loader/dist/cornerstoneWADOImageLoaderNoWebWorkers.bundle.min.js";

import { ImagePlus, AlertCircle } from "lucide-react";

let isCornerstoneConfigured = false;
function ensureCornerstoneConfigured() {
  if (isCornerstoneConfigured) return;
  cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
  cornerstoneWADOImageLoader.external.dicomParser = dicomParser;
  cornerstoneWADOImageLoader.configure({ useWebWorkers: false });
  isCornerstoneConfigured = true;
}

interface DicomThumbnailProps {
  file: File;
  className?: string;
}

export function DicomThumbnail({ file, className = "" }: DicomThumbnailProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!elementRef.current) return;

    ensureCornerstoneConfigured();

    const element = elementRef.current;

    setStatus("loading");

    try {
      cornerstone.enable(element);

      const imageId: string =
        cornerstoneWADOImageLoader.wadouri.fileManager.add(file);

      cornerstone
        .loadImage(imageId)
        .then((image: any) => {
          cornerstone.displayImage(element, image);
          setStatus("ready");
        })
        .catch((err: any) => {
          console.error("DicomThumbnail load error:", err);
          setStatus("error");
        });
    } catch (e) {
      console.error("DicomThumbnail init error:", e);
      setStatus("error");
    }

    return () => {
      try {
        cornerstone.disable(element);
      } catch {
        // ignore
      }
    };
  }, [file]);

  return (
    <div className={`relative w-full h-full ${className}`}>
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-secondary">
          <div className="h-6 w-6 rounded-full border-2 border-border border-t-cta animate-spin" />
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary">
          <AlertCircle className="w-6 h-6 text-destructive mb-1" />
          <span className="text-xs text-muted-foreground">Erro</span>
        </div>
      )}

      <div
        ref={elementRef}
        className="w-full h-full bg-black"
        style={{ visibility: status === "ready" ? "visible" : "hidden" }}
      />

      {status !== "ready" && status !== "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <ImagePlus className="w-8 h-8 text-muted-foreground mb-1" />
          <span className="text-xs text-muted-foreground font-medium">DICOM</span>
        </div>
      )}
    </div>
  );
}
