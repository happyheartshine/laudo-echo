import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, FileDown, Calendar, User, Stethoscope, Pencil, Mail, Trash2, Loader2, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { deleteExamImages, imageUrlToBase64, StoredImageData } from "@/lib/examImageUpload";
import { generateExamPdf, PdfExamData } from "@/lib/pdfGenerator";

interface PartnerClinic {
  id: string;
  nome: string;
  telefone: string | null;
}

interface Exam {
  id: string;
  patient_name: string;
  owner_name: string | null;
  species: string | null;
  breed: string | null;
  exam_date: string;
  content: unknown;
  created_at: string;
  partner_clinic_id: string | null;
}

// Função utilitária para formatar números no padrão BR
const formatNumber = (value: string | number): string => {
  if (value === "-" || value === "" || value === null || value === undefined) return "-";
  const str = typeof value === "number" ? value.toString() : value;
  return str.replace(".", ",");
};
export default function Historico() {
  const {
    user
  } = useAuth();
  const {
    profile,
    clinic
  } = useProfile();
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [selectedExamForEmail, setSelectedExamForEmail] = useState<Exam | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [partnerClinics, setPartnerClinics] = useState<PartnerClinic[]>([]);
  const [sendingWhatsAppId, setSendingWhatsAppId] = useState<string | null>(null);
  useEffect(() => {
    if (user) {
      fetchExams();
      fetchPartnerClinics();
    }
  }, [user]);
  const fetchExams = async () => {
    try {
      setLoading(true);
      const {
        data,
        error
      } = await supabase.from("exams").select("*").order("exam_date", {
        ascending: false
      });
      if (error) throw error;
      setExams(data || []);
    } catch (error) {
      console.error("Erro ao carregar exames:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os exames.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPartnerClinics = async () => {
    const { data, error } = await supabase
      .from("partner_clinics")
      .select("id, nome, telefone");
    
    if (!error && data) {
      setPartnerClinics(data);
    }
  };
  const filteredExams = exams.filter(exam => exam.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) || exam.owner_name && exam.owner_name.toLowerCase().includes(searchTerm.toLowerCase()));
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR");
  };
  const generatePdfFromExam = useCallback(async (exam: Exam): Promise<jsPDF> => {
    // Converte o content do exam para o formato esperado pelo gerador de PDF unificado
    const content = exam.content as PdfExamData;
    
    // Usa a função unificada de geração de PDF
    return generateExamPdf(content, { profile, clinic });
  }, [clinic, profile]);
  const handleReprint = async (exam: Exam) => {
    try {
      toast({
        title: "Gerando PDF...",
        description: "Aguarde enquanto o laudo é gerado."
      });
      const pdf = await generatePdfFromExam(exam);
      
      // Gera nome do arquivo com timestamp para evitar cache do navegador
      const now = new Date();
      const dateStr = now.toLocaleDateString('pt-BR').replace(/\//g, '');
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
      const fileName = `Laudo_${(exam.patient_name || 'Paciente').replace(/\s+/g, '_')}_${dateStr}_${timeStr}.pdf`;
      
      pdf.save(fileName);
      toast({
        title: "PDF gerado!",
        description: "O laudo foi baixado com sucesso."
      });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar o PDF.",
        variant: "destructive"
      });
    }
  };
  const handleEdit = (exam: Exam) => {
    // Navigate to edit page with exam ID
    navigate(`/novo-exame/dados-exame?id=${exam.id}`);
  };

  const handleWhatsApp = async (exam: Exam) => {
    try {
      setSendingWhatsAppId(exam.id);
      
      // Find phone number: Priority 1 - Partner Clinic
      let phoneNumber: string | null = null;
      let phoneSource = "";
      
      if (exam.partner_clinic_id) {
        const partnerClinic = partnerClinics.find(c => c.id === exam.partner_clinic_id);
        if (partnerClinic?.telefone) {
          phoneNumber = partnerClinic.telefone;
          phoneSource = partnerClinic.nome;
        }
      }
      
      // Fallback: Priority 2 - Tutor phone from exam content
      if (!phoneNumber) {
        const content = exam.content as Record<string, unknown>;
        const patientData = content?.patientData as Record<string, unknown>;
        if (patientData?.telefone && typeof patientData.telefone === 'string') {
          phoneNumber = patientData.telefone;
          phoneSource = "tutor";
        }
      }
      
      if (!phoneNumber) {
        toast({
          title: "Nenhum telefone cadastrado",
          description: "Cadastre o telefone na aba Parceiros ou nos dados do Tutor.",
          variant: "destructive"
        });
        return;
      }
      
      // Clean phone number (remove non-digits)
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      
      // Validate phone number
      if (cleanPhone.length < 10) {
        toast({
          title: "Telefone inválido",
          description: `O telefone ${phoneSource ? `de ${phoneSource}` : ''} parece incompleto.`,
          variant: "destructive"
        });
        return;
      }
      
      // Generate PDF silently
      const pdfDoc = await generatePdfFromExam(exam);
      const pdfBlob = pdfDoc.output('blob');
      
      // Create unique filename
      const safePatientName = exam.patient_name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "_")
        .toLowerCase();
      const fileName = `laudo_${exam.id}_${Date.now()}.pdf`;
      
      // Upload to exam-reports bucket
      const { error: uploadError } = await supabase.storage
        .from('exam-reports')
        .upload(fileName, pdfBlob, {
          contentType: 'application/pdf',
          upsert: true
        });
      
      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw uploadError;
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('exam-reports')
        .getPublicUrl(fileName);
      
      const pdfUrl = urlData.publicUrl;
      
      // Format date
      const examDate = new Date(exam.exam_date).toLocaleDateString('pt-BR');
      
      // Build WhatsApp message
      const doctorTitle = profile?.sexo === 'feminino' ? 'a Dra.' : 'o Dr.';
      const doctorName = profile?.nome || 'veterinário(a)';
      const message = `Olá! Aqui é ${doctorTitle} ${doctorName}. Segue o link do laudo do paciente *${exam.patient_name}* realizado em ${examDate}.\n\n📄 ${pdfUrl}`;
      
      // Open WhatsApp with Brazil country code
      const whatsappUrl = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
      
      toast({
        title: "WhatsApp aberto!",
        description: "Mensagem e link do laudo prontos para envio."
      });
    } catch (error) {
      console.error("Erro ao preparar WhatsApp:", error);
      toast({
        title: "Erro ao preparar envio",
        description: "Não foi possível gerar o link. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setSendingWhatsAppId(null);
    }
  };
  const handleOpenEmailDialog = (exam: Exam) => {
    setSelectedExamForEmail(exam);
    setEmailAddress("");
    setEmailDialogOpen(true);
  };
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const handleSendEmail = async () => {
    if (!selectedExamForEmail || !emailAddress) {
      toast({
        title: "Erro",
        description: "Por favor, insira um endereço de email válido.",
        variant: "destructive"
      });
      return;
    }
    try {
      setIsSendingEmail(true);

      // Generate PDF as Blob
      const pdfDoc = await generatePdfFromExam(selectedExamForEmail);
      const pdfBlob = pdfDoc.output('blob');

      // Sanitize patient name for filename
      const safePatientName = selectedExamForEmail.patient_name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
      const fileName = `laudo_${safePatientName}_${Date.now()}.pdf`;
      console.log("=== ENVIANDO EMAIL VIA EDGE FUNCTION ===");
      console.log("Para:", emailAddress);
      console.log("Paciente:", selectedExamForEmail.patient_name);
      console.log("Arquivo:", fileName);

      // Upload PDF to Storage
      const {
        data: uploadData,
        error: uploadError
      } = await supabase.storage.from('email-pdfs').upload(fileName, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true
      });
      if (uploadError) {
        console.error("Erro ao fazer upload do PDF:", uploadError);
        throw uploadError;
      }

      // Get public URL
      const {
        data: urlData
      } = supabase.storage.from('email-pdfs').getPublicUrl(fileName);
      const pdfUrl = urlData.publicUrl;
      console.log("PDF URL:", pdfUrl);

      // Send email via Edge Function
      const {
        data,
        error
      } = await supabase.functions.invoke('send-email', {
        body: {
          email: emailAddress,
          patientName: selectedExamForEmail.patient_name,
          pdfUrl: pdfUrl,
          senderName: profile?.nome || "Equipe Veterinária"
        }
      });
      if (error) {
        console.error("Erro ao enviar email:", error);
        throw error;
      }
      console.log("Email enviado com sucesso:", data);
      toast({
        title: "Email enviado!",
        description: `O laudo foi enviado para ${emailAddress} com sucesso.`
      });
      setEmailDialogOpen(false);
      setSelectedExamForEmail(null);
      setEmailAddress("");
    } catch (error: any) {
      console.error("Erro ao enviar email:", error);

      // Fallback: open mailto link
      const subject = encodeURIComponent(`Laudo Veterinário - ${selectedExamForEmail.patient_name}`);
      const body = encodeURIComponent(`Prezado(a),\n\nSegue em anexo o laudo ecocardiográfico do paciente ${selectedExamForEmail.patient_name}.\n\nAtenciosamente,\n${profile?.nome || "Equipe Veterinária"}`);
      window.open(`mailto:${emailAddress}?subject=${subject}&body=${body}`, "_blank");
      toast({
        title: "Falha no envio automático",
        description: "O cliente de email foi aberto. Anexe o PDF manualmente.",
        variant: "destructive"
      });
      setEmailDialogOpen(false);
      setSelectedExamForEmail(null);
    } finally {
      setIsSendingEmail(false);
    }
  };
  const handleOpenDeleteDialog = (exam: Exam) => {
    setExamToDelete(exam);
    setDeleteDialogOpen(true);
  };
  const handleDeleteExam = async () => {
    if (!examToDelete) return;
    try {
      setIsDeleting(true);

      // Deletar imagens do Storage primeiro
      await deleteExamImages(examToDelete.id);

      // Deletar exame do banco
      const {
        error
      } = await supabase.from("exams").delete().eq("id", examToDelete.id);
      if (error) throw error;

      // Atualizar lista local
      setExams(exams.filter(e => e.id !== examToDelete.id));
      toast({
        title: "Exame excluído!",
        description: "O exame foi removido com sucesso."
      });
    } catch (error) {
      console.error("Erro ao excluir exame:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o exame.",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setExamToDelete(null);
    }
  };
  return <Layout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Meus Exames</h1>
            <p className="text-muted-foreground">Histórico de laudos gerados</p>
          </div>
        </div>

        {/* Search */}
        <div className="card-vitaecor mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input placeholder="Buscar por nome do paciente ou tutor..." className="pl-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>

        {/* Table */}
        <div className="card-vitaecor">
          {loading ? <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div> : filteredExams.length === 0 ? <div className="text-center py-12">
              <Stethoscope className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm ? "Nenhum exame encontrado para esta busca." : "Nenhum exame salvo ainda."}
              </p>
            </div> : <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Data
                      </div>
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Paciente</th>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Responsável
                      </div>
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Espécie</th>
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExams.map(exam => <tr key={exam.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-foreground">{formatDate(exam.exam_date)}</td>
                      <td className="py-3 px-4 font-medium text-foreground">{exam.patient_name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{exam.owner_name || "-"}</td>
                      <td className="py-3 px-4 text-muted-foreground">{exam.species || "-"}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(exam)} title="Editar exame">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleWhatsApp(exam)} 
                            title="Enviar via WhatsApp"
                            disabled={sendingWhatsAppId === exam.id}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50 min-w-[60px]"
                          >
                            {sendingWhatsAppId === exam.id ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin mr-1" />
                                <span className="text-xs">Link...</span>
                              </>
                            ) : (
                              <MessageCircle className="w-4 h-4" />
                            )}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleOpenEmailDialog(exam)} title="Enviar por email">
                            <Mail className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleOpenDeleteDialog(exam)} title="Excluir exame" className="text-destructive hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleReprint(exam)} className="gap-2">
                            <FileDown className="w-4 h-4" />
                            PDF
                          </Button>
                        </div>
                      </td>
                    </tr>)}
                </tbody>
              </table>
            </div>}
        </div>

        {/* Stats */}
        {!loading && filteredExams.length > 0 && <div className="mt-4 text-sm text-muted-foreground text-center">
            {filteredExams.length} exame{filteredExams.length !== 1 ? "s" : ""} encontrado{filteredExams.length !== 1 ? "s" : ""}
          </div>}

        {/* Email Dialog */}
        <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enviar Laudo por Email</DialogTitle>
              <DialogDescription>
                Digite o endereço de email do destinatário para enviar o laudo do paciente{" "}
                <strong>{selectedExamForEmail?.patient_name}</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="email">Email do destinatário</Label>
              <Input id="email" type="email" placeholder="exemplo@email.com" value={emailAddress} onChange={e => setEmailAddress(e.target.value)} className="mt-2" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEmailDialogOpen(false)} disabled={isSendingEmail}>
                Cancelar
              </Button>
              <Button onClick={handleSendEmail} disabled={isSendingEmail || !emailAddress}>
                {isSendingEmail ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                {isSendingEmail ? "Enviando..." : "Enviar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Exame</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o exame do paciente{" "}
                <strong>{examToDelete?.patient_name}</strong>?
                <br />
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteExam} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {isDeleting ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>;
}