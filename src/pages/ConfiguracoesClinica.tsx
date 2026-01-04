import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, Upload, Trash2, Mail, UserPlus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TeamMember {
  id: string;
  nome: string;
  cargo: string;
  user_id: string;
}

interface TeamInvite {
  id: string;
  email: string;
  cargo: string;
  accepted: boolean;
  created_at: string;
}

export default function ConfiguracoesClinica() {
  const { toast } = useToast();
  const { profile, clinic, updateClinic, isGestor, loading } = useProfile();
  
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [endereco, setEndereco] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamInvites, setTeamInvites] = useState<TeamInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCargo, setInviteCargo] = useState<string>("veterinario");
  const [sendingInvite, setSendingInvite] = useState(false);

  useEffect(() => {
    if (clinic) {
      setNomeFantasia(clinic.nome_fantasia || "");
      setEndereco(clinic.endereco || "");
      if (clinic.logo_url) {
        setLogoPreview(clinic.logo_url);
      }
    }
  }, [clinic]);

  useEffect(() => {
    if (clinic?.id && isGestor) {
      fetchTeamMembers();
      fetchTeamInvites();
    }
  }, [clinic?.id, isGestor]);

  const fetchTeamMembers = async () => {
    if (!clinic?.id) return;
    
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nome, cargo, user_id")
      .eq("clinic_id", clinic.id);

    if (error) {
      console.error("Error fetching team:", error);
    } else {
      setTeamMembers(data as TeamMember[]);
    }
  };

  const fetchTeamInvites = async () => {
    if (!clinic?.id) return;
    
    const { data, error } = await supabase
      .from("team_invites")
      .select("*")
      .eq("clinic_id", clinic.id)
      .eq("accepted", false);

    if (error) {
      console.error("Error fetching invites:", error);
    } else {
      setTeamInvites(data as TeamInvite[]);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setLogoPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleUploadLogo = async () => {
    if (!logoFile || !clinic) return;

    setUploadingLogo(true);
    
    const fileExt = logoFile.name.split('.').pop();
    const fileName = `${clinic.id}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("clinic-logos")
      .upload(filePath, logoFile, { upsert: true });

    if (uploadError) {
      toast({
        title: "Erro no upload",
        description: "Não foi possível fazer upload da logo.",
        variant: "destructive",
      });
      setUploadingLogo(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("clinic-logos")
      .getPublicUrl(filePath);

    const { error: updateError } = await updateClinic({ logo_url: publicUrl });

    if (updateError) {
      toast({
        title: "Erro",
        description: "Não foi possível salvar a URL da logo.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Logo atualizada!",
        description: "A logo da clínica foi atualizada com sucesso.",
      });
      setLogoFile(null);
    }

    setUploadingLogo(false);
  };

  const handleRemoveLogo = async () => {
    if (!clinic?.logo_url) return;

    const { error } = await updateClinic({ logo_url: null });

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível remover a logo.",
        variant: "destructive",
      });
    } else {
      setLogoPreview(null);
      toast({
        title: "Logo removida",
        description: "A logo da clínica foi removida.",
      });
    }
  };

  const handleSaveClinic = async () => {
    setSaving(true);
    
    const { error } = await updateClinic({
      nome_fantasia: nomeFantasia,
      endereco: endereco,
    });

    setSaving(false);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível salvar as alterações.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Salvo!",
        description: "As configurações da clínica foram atualizadas.",
      });
    }
  };

  const handleSendInvite = async () => {
    if (!inviteEmail || !clinic?.id || !profile?.user_id) return;

    setSendingInvite(true);

    const { error } = await supabase
      .from("team_invites")
      .insert({
        clinic_id: clinic.id,
        email: inviteEmail,
        cargo: inviteCargo as "gestor" | "super_admin" | "veterinario",
        invited_by: profile.user_id,
      });

    setSendingInvite(false);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível enviar o convite.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Convite enviado!",
        description: `Convite enviado para ${inviteEmail}. Quando o usuário se cadastrar, será adicionado automaticamente à sua equipe.`,
      });
      setInviteEmail("");
      fetchTeamInvites();
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    const { error } = await supabase
      .from("team_invites")
      .delete()
      .eq("id", inviteId);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível remover o convite.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Convite removido",
        description: "O convite foi cancelado.",
      });
      fetchTeamInvites();
    }
  };

  const cargoLabel = (cargo: string) => {
    const labels: Record<string, string> = {
      super_admin: "Super Admin",
      gestor: "Gestor",
      veterinario: "Veterinário",
    };
    return labels[cargo] || cargo;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </Layout>
    );
  }

  if (!isGestor) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Acesso restrito</CardTitle>
              <CardDescription>
                Apenas gestores podem acessar as configurações da clínica.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Configurações da Clínica</h1>
          <p className="text-muted-foreground">Personalize sua clínica e gerencie sua equipe</p>
        </div>

        <Tabs defaultValue="clinica">
          <TabsList className="mb-6">
            <TabsTrigger value="clinica" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Dados da Clínica
            </TabsTrigger>
            <TabsTrigger value="equipe" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Equipe
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clinica">
            <div className="space-y-6">
              {/* Logo Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Logo da Clínica (White Label)</CardTitle>
                  <CardDescription>
                    Esta logo será usada nos PDFs gerados. Se não configurada, será usada a logo padrão VitaeCor.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start gap-6">
                    <div className="w-32 h-32 border-2 border-dashed border-border rounded-lg flex items-center justify-center overflow-hidden bg-muted">
                      {logoPreview ? (
                        <img 
                          src={logoPreview} 
                          alt="Logo da clínica" 
                          className="w-full h-full object-contain p-2"
                        />
                      ) : (
                        <Building2 className="w-12 h-12 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <Label htmlFor="logo-upload">Selecionar imagem</Label>
                        <Input
                          id="logo-upload"
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handleLogoChange}
                          className="mt-1"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          onClick={handleUploadLogo} 
                          disabled={!logoFile || uploadingLogo}
                          size="sm"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          {uploadingLogo ? "Enviando..." : "Fazer Upload"}
                        </Button>
                        {clinic?.logo_url && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={handleRemoveLogo}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remover
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Clinic Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informações</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome-fantasia">Nome Fantasia</Label>
                    <Input
                      id="nome-fantasia"
                      value={nomeFantasia}
                      onChange={(e) => setNomeFantasia(e.target.value)}
                      placeholder="Nome da sua clínica"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endereco">Endereço</Label>
                    <Input
                      id="endereco"
                      value={endereco}
                      onChange={(e) => setEndereco(e.target.value)}
                      placeholder="Endereço completo"
                    />
                  </div>
                  <Button onClick={handleSaveClinic} disabled={saving} className="btn-cta">
                    {saving ? "Salvando..." : "Salvar Alterações"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="equipe">
            <div className="space-y-6">
              {/* Invite Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <UserPlus className="w-5 h-5" />
                    Convidar Membro
                  </CardTitle>
                  <CardDescription>
                    Envie um convite por email. Quando o convidado se cadastrar, será adicionado automaticamente à sua equipe.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <Input
                        type="email"
                        placeholder="email@exemplo.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                      />
                    </div>
                    <Select value={inviteCargo} onValueChange={setInviteCargo}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="veterinario">Veterinário</SelectItem>
                        <SelectItem value="gestor">Gestor</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={handleSendInvite} disabled={sendingInvite || !inviteEmail}>
                      <Mail className="w-4 h-4 mr-2" />
                      {sendingInvite ? "Enviando..." : "Convidar"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Pending Invites */}
              {teamInvites.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Convites Pendentes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Cargo</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="w-20"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamInvites.map((invite) => (
                          <TableRow key={invite.id}>
                            <TableCell>{invite.email}</TableCell>
                            <TableCell>{cargoLabel(invite.cargo)}</TableCell>
                            <TableCell>
                              {new Date(invite.created_at).toLocaleDateString('pt-BR')}
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleDeleteInvite(invite.id)}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Team Members */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Membros da Equipe</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Cargo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamMembers.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">
                            {member.nome}
                            {member.user_id === profile?.user_id && (
                              <span className="ml-2 text-xs text-muted-foreground">(você)</span>
                            )}
                          </TableCell>
                          <TableCell>{cargoLabel(member.cargo)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
