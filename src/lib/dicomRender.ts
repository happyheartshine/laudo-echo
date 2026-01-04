// Convert a DICOM file into a JPEG data URL by rendering it with Cornerstone (offscreen)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import cornerstone from "cornerstone-core";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import dicomParser from "dicom-parser";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import cornerstoneWADOImageLoader from "cornerstone-wado-image-loader/dist/cornerstoneWADOImageLoaderNoWebWorkers.bundle.min.js";

let isCornerstoneConfigured = false;
function ensureCornerstoneConfigured() {
  if (isCornerstoneConfigured) return;

  cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
  cornerstoneWADOImageLoader.external.dicomParser = dicomParser;
  cornerstoneWADOImageLoader.configure({ useWebWorkers: false });

  isCornerstoneConfigured = true;
}

function raf() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export async function dicomFileToJpegDataUrl(file: File, quality = 0.8): Promise<string> {
  ensureCornerstoneConfigured();

  const element = document.createElement("div");
  element.style.position = "fixed";
  element.style.left = "-10000px";
  element.style.top = "0";
  element.style.width = "1024px";
  element.style.height = "1024px";
  element.style.background = "black";

  document.body.appendChild(element);

  try {
    cornerstone.enable(element);

    const imageId: string = cornerstoneWADOImageLoader.wadouri.fileManager.add(file);
    const image: any = await cornerstone.loadImage(imageId);

    // Try to preserve aspect ratio and avoid huge offscreen canvases.
    const maxSide = 1024;
    const w = Number(image?.width) || maxSide;
    const h = Number(image?.height) || maxSide;
    const scale = Math.min(1, maxSide / Math.max(w, h));

    element.style.width = `${Math.max(1, Math.round(w * scale))}px`;
    element.style.height = `${Math.max(1, Math.round(h * scale))}px`;

    try {
      cornerstone.resize(element, true);
    } catch {
      // ignore resize issues; displayImage will still work in most cases
    }

    cornerstone.displayImage(element, image);
    await raf();

    const canvas = element.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) throw new Error("Canvas não encontrado ao renderizar DICOM");

    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    try {
      cornerstone.disable(element);
    } catch {
      // ignore
    }
    element.remove();
  }
}
