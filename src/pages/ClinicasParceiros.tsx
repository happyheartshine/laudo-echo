import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, UserPlus, Building2, Users, Upload, ImageIcon, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { ClinicServicesSection } from "@/components/partners/ClinicServicesSection";

interface PartnerClinic {
  id: string;
  nome: string;
  valor_exame: number;
  responsavel: string | null;
  telefone: string | null;
  email: string | null;
  logo_url: string | null;
  created_at: string;
}

interface PartnerVeterinarian {
  id: string;
  partner_clinic_id: string;
  nome: string;
  created_at: string;
}

export default function ClinicasParceiros() {
  const { user } = useAuth();
  const { clinic } = useProfile();
  const { toast } = useToast();

  const [clinics, setClinics] = useState<PartnerClinic[]>([]);
  const [veterinarians, setVeterinarians] = useState<PartnerVeterinarian[]>([]);
  const [loading, setLoading] = useState(true);

  // New clinic form
  const [isClinicDialogOpen, setIsClinicDialogOpen] = useState(false);
  const [newClinicName, setNewClinicName] = useState("");
  const [newClinicResponsavel, setNewClinicResponsavel] = useState("");
  const [newClinicTelefone, setNewClinicTelefone] = useState("");
  const [newClinicEmail, setNewClinicEmail] = useState("");
  const [newClinicLogoFile, setNewClinicLogoFile] = useState<File | null>(null);
  const [newClinicLogoPreview, setNewClinicLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // New vet form
  const [isVetDialogOpen, setIsVetDialogOpen] = useState(false);
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [newVetName, setNewVetName] = useState("");

  // Edit clinic form
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingClinic, setEditingClinic] = useState<PartnerClinic | null>(null);
  const [editClinicName, setEditClinicName] = useState("");
  const [editClinicResponsavel, setEditClinicResponsavel] = useState("");
  const [editClinicTelefone, setEditClinicTelefone] = useState("");
  const [editClinicEmail, setEditClinicEmail] = useState("");
  const [editClinicLogoFile, setEditClinicLogoFile] = useState<File | null>(null);
  const [editClinicLogoPreview, setEditClinicLogoPreview] = useState<string | null>(null);
  const [updatingClinic, setUpdatingClinic] = useState(false);
  const editLogoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch partner clinics
    const { data: clinicsData, error: clinicsError } = await supabase
      .from("partner_clinics")
      .select("*")
      .order("nome");

    if (clinicsError) {
      console.error("Error fetching partner clinics:", clinicsError);
    } else {
      setClinics((clinicsData || []) as unknown as PartnerClinic[]);
    }

    // Fetch partner veterinarians
    const { data: vetsData, error: vetsError } = await supabase
      .from("partner_veterinarians")
      .select("*")
      .order("nome");

    if (vetsError) {
      console.error("Error fetching partner veterinarians:", vetsError);
    } else {
      setVeterinarians(vetsData || []);
    }

    setLoading(false);
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({ title: "Erro", description: "Selecione um arquivo de imagem (JPG, PNG)", variant: "destructive" });
        return;
      }
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast({ title: "Erro", description: "Imagem deve ter no máximo 2MB", variant: "destructive" });
        return;
      }
      setNewClinicLogoFile(file);
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewClinicLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadLogo = async (clinicId: string): Promise<string | null> => {
    if (!newClinicLogoFile) return null;

    const fileExt = newClinicLogoFile.name.split('.').pop();
    const fileName = `partner-${clinicId}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('clinic-logos')
      .upload(fileName, newClinicLogoFile, { upsert: true });

    if (uploadError) {
      console.error("Error uploading logo:", uploadError);
      return null;
    }

    const { data } = supabase.storage.from('clinic-logos').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleCreateClinic = async () => {
    if (!newClinicName.trim()) {
      toast({ title: "Erro", description: "Nome da clínica é obrigatório", variant: "destructive" });
      return;
    }

    setUploadingLogo(true);

    // First, insert the clinic to get its ID
    const { data: insertedClinic, error } = await supabase.from("partner_clinics").insert({
      user_id: user?.id,
      clinic_id: clinic?.id || null,
      nome: newClinicName.trim(),
      valor_exame: 0, // Default value, prices are now in clinic_services
      responsavel: newClinicResponsavel.trim() || null,
      telefone: newClinicTelefone.trim() || null,
      email: newClinicEmail.trim() || null,
    }).select().single();

    if (error) {
      console.error("Error creating partner clinic:", error);
      toast({ title: "Erro", description: "Erro ao criar clínica parceira", variant: "destructive" });
      setUploadingLogo(false);
      return;
    }

    // If there's a logo file, upload it and update the clinic
    if (newClinicLogoFile && insertedClinic) {
      const logoUrl = await uploadLogo(insertedClinic.id);
      if (logoUrl) {
        await supabase.from("partner_clinics")
          .update({ logo_url: logoUrl })
          .eq("id", insertedClinic.id);
      }
    }

    toast({ title: "Sucesso", description: "Clínica parceira cadastrada!" });
    resetClinicForm();
    setIsClinicDialogOpen(false);
    fetchData();
    setUploadingLogo(false);
  };

  const resetClinicForm = () => {
    setNewClinicName("");
    setNewClinicResponsavel("");
    setNewClinicTelefone("");
    setNewClinicEmail("");
    setNewClinicLogoFile(null);
    setNewClinicLogoPreview(null);
  };

  // ========== Edit Clinic Functions ==========
  const handleOpenEditDialog = (clinic: PartnerClinic) => {
    setEditingClinic(clinic);
    setEditClinicName(clinic.nome);
    setEditClinicResponsavel(clinic.responsavel || "");
    setEditClinicTelefone(clinic.telefone || "");
    setEditClinicEmail(clinic.email || "");
    setEditClinicLogoFile(null);
    setEditClinicLogoPreview(clinic.logo_url || null);
    setIsEditDialogOpen(true);
  };

  const handleEditLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({ title: "Erro", description: "Selecione um arquivo de imagem (JPG, PNG)", variant: "destructive" });
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast({ title: "Erro", description: "Imagem deve ter no máximo 2MB", variant: "destructive" });
        return;
      }
      setEditClinicLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditClinicLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadEditLogo = async (clinicId: string): Promise<string | null> => {
    if (!editClinicLogoFile) return null;

    const fileExt = editClinicLogoFile.name.split('.').pop();
    const fileName = `partner-${clinicId}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('clinic-logos')
      .upload(fileName, editClinicLogoFile, { upsert: true });

    if (uploadError) {
      console.error("Error uploading logo:", uploadError);
      return null;
    }

    const { data } = supabase.storage.from('clinic-logos').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleUpdateClinic = async () => {
    if (!editingClinic || !editClinicName.trim()) {
      toast({ title: "Erro", description: "Nome da clínica é obrigatório", variant: "destructive" });
      return;
    }

    setUpdatingClinic(true);

    let logoUrl = editingClinic.logo_url;

    // If there's a new logo file, upload it
    if (editClinicLogoFile) {
      const newLogoUrl = await uploadEditLogo(editingClinic.id);
      if (newLogoUrl) {
        logoUrl = newLogoUrl;
      }
    }

    const { error } = await supabase
      .from("partner_clinics")
      .update({
        nome: editClinicName.trim(),
        responsavel: editClinicResponsavel.trim() || null,
        telefone: editClinicTelefone.trim() || null,
        email: editClinicEmail.trim() || null,
        logo_url: logoUrl,
      })
      .eq("id", editingClinic.id);

    if (error) {
      console.error("Error updating partner clinic:", error);
      toast({ title: "Erro", description: "Erro ao atualizar clínica parceira", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Clínica atualizada com sucesso!" });
      setIsEditDialogOpen(false);
      setEditingClinic(null);
      fetchData();
    }

    setUpdatingClinic(false);
  };

  const handleDeleteClinic = async (id: string) => {
    const { error } = await supabase.from("partner_clinics").delete().eq("id", id);

    if (error) {
      console.error("Error deleting partner clinic:", error);
      toast({ title: "Erro", description: "Erro ao excluir clínica", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Clínica excluída!" });
      fetchData();
    }
  };

  const handleOpenVetDialog = (clinicId: string) => {
    setSelectedClinicId(clinicId);
    setNewVetName("");
    setIsVetDialogOpen(true);
  };

  const handleCreateVet = async () => {
    if (!newVetName.trim() || !selectedClinicId) {
      toast({ title: "Erro", description: "Nome do veterinário é obrigatório", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("partner_veterinarians").insert({
      partner_clinic_id: selectedClinicId,
      nome: newVetName.trim(),
    });

    if (error) {
      console.error("Error creating partner vet:", error);
      toast({ title: "Erro", description: "Erro ao cadastrar veterinário", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Veterinário cadastrado!" });
      setNewVetName("");
      setIsVetDialogOpen(false);
      fetchData();
    }
  };

  const handleDeleteVet = async (id: string) => {
    const { error } = await supabase.from("partner_veterinarians").delete().eq("id", id);

    if (error) {
      console.error("Error deleting partner vet:", error);
      toast({ title: "Erro", description: "Erro ao excluir veterinário", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Veterinário excluído!" });
      fetchData();
    }
  };

  const getVetsForClinic = (clinicId: string) => {
    return veterinarians.filter((vet) => vet.partner_clinic_id === clinicId);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Parceiros</h1>
            <p className="text-muted-foreground">
              Gerencie suas clínicas parceiras e veterinários vinculados
            </p>
          </div>
          <Dialog open={isClinicDialogOpen} onOpenChange={setIsClinicDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nova Clínica
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar Clínica Parceira</DialogTitle>
                <DialogDescription>
                  Cadastre uma nova clínica parceira. Você poderá adicionar serviços e preços após o cadastro.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Logo Upload */}
                <div className="space-y-2">
                  <Label>Logo da Clínica</Label>
                  <div className="flex items-center gap-4">
                    <div
                      className="w-20 h-20 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors overflow-hidden"
                      onClick={() => logoInputRef.current?.click()}
                    >
                      {newClinicLogoPreview ? (
                        <img
                          src={newClinicLogoPreview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => logoInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Selecionar imagem
                      </Button>
                      <p className="text-xs text-muted-foreground mt-1">
                        JPG ou PNG, máx. 2MB
                      </p>
                    </div>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/jpg"
                      className="hidden"
                      onChange={handleLogoFileChange}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clinic-name">Nome da Clínica *</Label>
                  <Input
                    id="clinic-name"
                    placeholder="Ex: Clínica Vet Center"
                    value={newClinicName}
                    onChange={(e) => setNewClinicName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clinic-responsavel">Responsável / Contato</Label>
                  <Input
                    id="clinic-responsavel"
                    placeholder="Ex: Dr. João Silva"
                    value={newClinicResponsavel}
                    onChange={(e) => setNewClinicResponsavel(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clinic-telefone">Telefone / WhatsApp</Label>
                  <Input
                    id="clinic-telefone"
                    placeholder="Ex: 11999998888"
                    value={newClinicTelefone}
                    onChange={(e) => setNewClinicTelefone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clinic-email">E-mail</Label>
                  <Input
                    id="clinic-email"
                    type="email"
                    placeholder="Ex: contato@clinica.com.br"
                    value={newClinicEmail}
                    onChange={(e) => setNewClinicEmail(e.target.value)}
                  />
                </div>
                <Button onClick={handleCreateClinic} className="w-full" disabled={uploadingLogo}>
                  {uploadingLogo ? "Cadastrando..." : "Cadastrar Clínica"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Clinics List */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : clinics.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-muted/30">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma clínica parceira cadastrada.</p>
            <p className="text-sm text-muted-foreground">
              Clique em "Nova Clínica" para começar.
            </p>
          </div>
        ) : (
          <Accordion type="multiple" className="space-y-2">
            {clinics.map((partnerClinic) => {
              const vets = getVetsForClinic(partnerClinic.id);
              return (
                <AccordionItem
                  key={partnerClinic.id}
                  value={partnerClinic.id}
                  className="border rounded-lg px-4 bg-card"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        {partnerClinic.logo_url ? (
                          <img
                            src={partnerClinic.logo_url}
                            alt={partnerClinic.nome}
                            className="w-10 h-10 rounded-lg object-cover border"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="text-left">
                          <p className="font-medium">{partnerClinic.nome}</p>
                          <p className="text-sm text-muted-foreground">
                            {partnerClinic.responsavel && `${partnerClinic.responsavel}`}
                            {partnerClinic.responsavel && partnerClinic.telefone && " • "}
                            {partnerClinic.telefone && `${partnerClinic.telefone}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="w-4 h-4" />
                        {vets.length} veterinário{vets.length !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4">
                    <Tabs defaultValue="veterinarios" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="veterinarios">Veterinários</TabsTrigger>
                        <TabsTrigger value="precos">Tabela de Preços</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="veterinarios" className="space-y-4 mt-4">
                        {/* Veterinarians Table */}
                        {vets.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Nome do Veterinário</TableHead>
                                <TableHead className="w-20">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {vets.map((vet) => (
                                <TableRow key={vet.id}>
                                  <TableCell>{vet.nome}</TableCell>
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-destructive hover:text-destructive"
                                      onClick={() => handleDeleteVet(vet.id)}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Nenhum veterinário vinculado a esta clínica.
                          </p>
                        )}

                        {/* Add Vet Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenVetDialog(partnerClinic.id)}
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          Adicionar Veterinário
                        </Button>
                      </TabsContent>
                      
                      <TabsContent value="precos" className="mt-4">
                        <ClinicServicesSection clinicId={partnerClinic.id} />
                      </TabsContent>
                    </Tabs>

                    {/* Clinic Actions */}
                    <div className="flex gap-2 pt-4 border-t mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEditDialog(partnerClinic)}
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Editar Clínica
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteClinic(partnerClinic.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir Clínica
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}

        {/* Add Vet Dialog */}
        <Dialog open={isVetDialogOpen} onOpenChange={setIsVetDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Veterinário</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="vet-name">Nome do Veterinário *</Label>
                <Input
                  id="vet-name"
                  placeholder="Ex: Dra. Maria Santos"
                  value={newVetName}
                  onChange={(e) => setNewVetName(e.target.value)}
                />
              </div>
              <Button onClick={handleCreateVet} className="w-full">
                Cadastrar Veterinário
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Clinic Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Clínica Parceira</DialogTitle>
              <DialogDescription>
                Atualize os dados da clínica. Você pode alterar a logo ou adicionar uma se ainda não houver.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Logo Upload */}
              <div className="space-y-2">
                <Label>Logo da Clínica</Label>
                <div className="flex items-center gap-4">
                  <div
                    className="w-20 h-20 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors overflow-hidden"
                    onClick={() => editLogoInputRef.current?.click()}
                  >
                    {editClinicLogoPreview ? (
                      <img
                        src={editClinicLogoPreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => editLogoInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {editClinicLogoPreview ? "Alterar imagem" : "Adicionar imagem"}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      JPG ou PNG, máx. 2MB
                    </p>
                  </div>
                  <input
                    ref={editLogoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/jpg"
                    className="hidden"
                    onChange={handleEditLogoFileChange}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-clinic-name">Nome da Clínica *</Label>
                <Input
                  id="edit-clinic-name"
                  placeholder="Ex: Clínica Vet Center"
                  value={editClinicName}
                  onChange={(e) => setEditClinicName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-clinic-responsavel">Responsável / Contato</Label>
                <Input
                  id="edit-clinic-responsavel"
                  placeholder="Ex: Dr. João Silva"
                  value={editClinicResponsavel}
                  onChange={(e) => setEditClinicResponsavel(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-clinic-telefone">Telefone / WhatsApp</Label>
                <Input
                  id="edit-clinic-telefone"
                  placeholder="Ex: 11999998888"
                  value={editClinicTelefone}
                  onChange={(e) => setEditClinicTelefone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-clinic-email">E-mail</Label>
                <Input
                  id="edit-clinic-email"
                  type="email"
                  placeholder="Ex: contato@clinica.com.br"
                  value={editClinicEmail}
                  onChange={(e) => setEditClinicEmail(e.target.value)}
                />
              </div>
              <Button onClick={handleUpdateClinic} className="w-full" disabled={updatingClinic}>
                {updatingClinic ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
