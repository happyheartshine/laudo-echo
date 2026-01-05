import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDown, X } from "lucide-react";

interface PdfPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfBlobUrl: string | null;
  onDownload: () => void;
  patientName: string;
}

export function PdfPreviewDialog({
  open,
  onOpenChange,
  pdfBlobUrl,
  onDownload,
  patientName,
}: PdfPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl flex flex-col">
        <DialogHeader className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="truncate">Preview do Laudo - {patientName}</DialogTitle>
              <DialogDescription>
                Caso não apareça no navegador, use “Baixar PDF”.
              </DialogDescription>
            </div>

            <div className="flex gap-2 shrink-0">
              <Button onClick={onDownload}>
                <FileDown className="w-4 h-4 mr-2" />
                Baixar PDF
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                <X className="w-4 h-4 mr-2" />
                Fechar
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-2">
          {pdfBlobUrl ? (
            <iframe
              src={pdfBlobUrl}
              title="PDF Preview"
              width="100%"
              height="80vh"
              className="w-full rounded-lg border"
            />
          ) : (
            <div className="w-full h-[80vh] flex items-center justify-center bg-muted rounded-lg">
              <p className="text-muted-foreground">Gerando preview...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

