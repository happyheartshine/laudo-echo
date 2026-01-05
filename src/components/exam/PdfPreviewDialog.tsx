import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDown, X } from "lucide-react";

interface PdfPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfDataUrl: string | null;
  onDownload: () => void;
  patientName: string;
}

export function PdfPreviewDialog({
  open,
  onOpenChange,
  pdfDataUrl,
  onDownload,
  patientName,
}: PdfPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Preview do Laudo - {patientName}</DialogTitle>
          <DialogDescription>
            Visualize o documento antes de baixar
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 min-h-0">
          {pdfDataUrl ? (
            <object
              data={pdfDataUrl}
              type="application/pdf"
              className="w-full h-full rounded-lg border"
            >
              <div className="w-full h-full flex flex-col items-center justify-center bg-muted rounded-lg p-4">
                <p className="text-muted-foreground text-center mb-4">
                  Seu navegador não suporta visualização de PDF embutida.
                </p>
                <Button onClick={onDownload}>
                  <FileDown className="w-4 h-4 mr-2" />
                  Baixar PDF
                </Button>
              </div>
            </object>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted rounded-lg">
              <p className="text-muted-foreground">Gerando preview...</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-2" />
            Fechar
          </Button>
          <Button className="btn-cta" onClick={onDownload}>
            <FileDown className="w-4 h-4 mr-2" />
            Baixar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
