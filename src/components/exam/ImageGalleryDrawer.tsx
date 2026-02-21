import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useDragControls, useMotionValue, PanInfo, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Images, X, ZoomIn, ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent } from "@/components/ui/sheet";

interface StoredImageData {
  name: string;
  type: string;
  dataUrl: string;
}

interface ImageGalleryDrawerProps {
  images: StoredImageData[];
  selectedIndices: number[];
}

// NEW key to force reset of old positions
const STORAGE_KEY = "gallery_pos_v2";
const DEFAULT_MARGIN = 30;
const CLICK_THRESHOLD = 3;
const FAB_WIDTH = 140;
const FAB_HEIGHT = 44;

type XY = { x: number; y: number };

const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function clampToViewport(pos: XY, size: { width: number; height: number }, margin = 10): XY {
  const maxX = Math.max(margin, window.innerWidth - size.width - margin);
  const maxY = Math.max(margin, window.innerHeight - size.height - margin);
  return {
    x: clamp(pos.x, margin, maxX),
    y: clamp(pos.y, margin, maxY),
  };
}

// Get default bottom-right FAB position
function getDefaultFabPosition(): XY {
  return {
    x: window.innerWidth - FAB_WIDTH - DEFAULT_MARGIN,
    y: window.innerHeight - FAB_HEIGHT - DEFAULT_MARGIN,
  };
}

function readSavedPosition(): XY | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !isFiniteNumber(parsed.x) || !isFiniteNumber(parsed.y)) return null;
    // Validate position is within reasonable bounds
    if (parsed.x < 0 || parsed.y < 0 || parsed.x > 5000 || parsed.y > 5000) return null;
    return { x: parsed.x, y: parsed.y };
  } catch {
    return null;
  }
}

function savePosition(pos: XY) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch {
    // ignore
  }
}

export function ImageGalleryDrawer({ images, selectedIndices }: ImageGalleryDrawerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<number | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Track if drag exceeded threshold to distinguish click from drag
  const dragStartPos = useRef<XY | null>(null);
  const wasDragged = useRef(false);

  const constraintsRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<HTMLDivElement | null>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const dragControls = useDragControls();

  const selectedImages = useMemo(
    () => images.filter((_, index) => selectedIndices.includes(index)),
    [images, selectedIndices],
  );

  // Initial position: bottom-right FAB (fixed position)
  useLayoutEffect(() => {
    if (selectedImages.length === 0) return;

    const size = { width: FAB_WIDTH, height: FAB_HEIGHT };
    const saved = readSavedPosition();
    const initial = saved ? clampToViewport(saved, size, 10) : getDefaultFabPosition();

    x.set(initial.x);
    y.set(initial.y);
    setIsReady(true);
  }, [selectedImages.length, x, y]);

  // Keep position inside viewport when resizing
  useEffect(() => {
    if (!isReady) return;
    const onResize = () => {
      const size = { width: FAB_WIDTH, height: FAB_HEIGHT };
      const clamped = clampToViewport({ x: x.get(), y: y.get() }, size, 10);
      x.set(clamped.x);
      y.set(clamped.y);
      savePosition(clamped);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isReady, x, y]);

  const handleDragStart = () => {
    dragStartPos.current = { x: x.get(), y: y.get() };
    wasDragged.current = false;
  };

  const handleDrag = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // Check if movement exceeds threshold
    const distance = Math.sqrt(info.offset.x ** 2 + info.offset.y ** 2);
    if (distance > CLICK_THRESHOLD) {
      wasDragged.current = true;
    }
  };

  const handleDragEnd = () => {
    const size = { width: FAB_WIDTH, height: FAB_HEIGHT };
    const clamped = clampToViewport({ x: x.get(), y: y.get() }, size, 10);
    x.set(clamped.x);
    y.set(clamped.y);
    savePosition(clamped);
  };

  // Handle button click - only toggle if it was a clean click (not a drag)
  const handleButtonClick = () => {
    if (wasDragged.current) {
      wasDragged.current = false;
      return;
    }
    setIsExpanded(true);
  };

  // Keyboard navigation in lightbox
  useEffect(() => {
    if (zoomedImage === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setZoomedImage((prev) => 
          prev !== null ? (prev > 0 ? prev - 1 : selectedImages.length - 1) : null
        );
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setZoomedImage((prev) => 
          prev !== null ? (prev < selectedImages.length - 1 ? prev + 1 : 0) : null
        );
      } else if (e.key === "Escape") {
        setZoomedImage(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [zoomedImage, selectedImages.length]);

  const handlePrevImage = useCallback(() => {
    if (zoomedImage === null) return;
    setZoomedImage(zoomedImage > 0 ? zoomedImage - 1 : selectedImages.length - 1);
  }, [zoomedImage, selectedImages.length]);

  const handleNextImage = useCallback(() => {
    if (zoomedImage === null) return;
    setZoomedImage(zoomedImage < selectedImages.length - 1 ? zoomedImage + 1 : 0);
  }, [zoomedImage, selectedImages.length]);

  // Don't render if no images
  if (selectedImages.length === 0) {
    return null;
  }

  // Render in a Portal to avoid being clipped by any parent overflow
  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* Full-viewport constraints layer (no pointer events) */}
      <div ref={constraintsRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 9998 }} />

      {/* Draggable floating button (FAB) - only shows when gallery is closed */}
      <AnimatePresence>
        {!isExpanded && (
          <motion.div
            ref={widgetRef}
            drag
            dragControls={dragControls}
            dragConstraints={constraintsRef}
            dragMomentum={false}
            dragElastic={0.25}
            onDragStart={handleDragStart}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: isReady ? 1 : 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              zIndex: 9999,
              touchAction: "none",
              x,
              y,
              pointerEvents: isReady ? "auto" : "none",
            }}
            className="select-none"
          >
            <motion.button
              onClick={handleButtonClick}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg bg-background border border-border hover:bg-accent transition-colors cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="w-4 h-4 text-muted-foreground" />
              <Images className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Imagens</span>
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium rounded-full bg-primary text-primary-foreground">
                {selectedImages.length}
              </span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fixed sidebar gallery panel - 100% height on the right side */}
      <Sheet open={isExpanded} onOpenChange={setIsExpanded}>
        <SheetContent side="right" className="w-[320px] sm:w-[380px] p-0 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Images className="w-5 h-5 text-primary" />
              <span className="text-base font-semibold">Galeria de Imagens</span>
              <span className="text-sm text-muted-foreground">({selectedImages.length})</span>
            </div>
          </div>

          {/* Thumbnails grid - scrollable area */}
          <ScrollArea className="flex-1">
            <div className="p-4 grid grid-cols-2 gap-3">
              {selectedImages.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setZoomedImage(index)}
                  className="group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted hover:border-primary transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <img
                    src={image.dataUrl}
                    alt={image.name || `Imagem ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <span className="absolute bottom-1 left-1 text-xs bg-black/70 text-white px-1.5 py-0.5 rounded">
                    {index + 1}
                  </span>
                </button>
              ))}
            </div>
          </ScrollArea>

          {/* Footer hint */}
          <div className="p-3 border-t bg-muted/20 text-center">
            <span className="text-xs text-muted-foreground">Clique em uma imagem para ampliar</span>
          </div>
        </SheetContent>
      </Sheet>

      {/* Zoom Dialog / Lightbox */}
      <Dialog open={zoomedImage !== null} onOpenChange={(open) => !open && setZoomedImage(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden bg-black/95">
          <DialogTitle className="sr-only">Visualização da imagem do exame</DialogTitle>
          <button
            onClick={() => setZoomedImage(null)}
            className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>

          {selectedImages.length > 1 && (
            <>
              <button
                onClick={handlePrevImage}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-50 p-3 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                aria-label="Imagem anterior"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button
                onClick={handleNextImage}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-50 p-3 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                aria-label="Próxima imagem"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </>
          )}

          {zoomedImage !== null && selectedImages[zoomedImage] && (
            <div className="flex items-center justify-center w-full h-full min-h-[60vh]">
              <img
                src={selectedImages[zoomedImage].dataUrl}
                alt={selectedImages[zoomedImage].name || `Imagem ${zoomedImage + 1}`}
                className="max-w-full max-h-[85vh] object-contain"
              />
            </div>
          )}

          {zoomedImage !== null && selectedImages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-full text-sm flex items-center gap-3">
              <span className="text-muted-foreground text-xs">← →</span>
              <span>{zoomedImage + 1} / {selectedImages.length}</span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>,
    document.body,
  );
}
