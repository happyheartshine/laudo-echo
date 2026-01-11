import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, User, Building2 } from "lucide-react";

const UF_OPTIONS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export default function Configuracoes() {
  const { profile, clinic, loading, updateProfile, updateClinic } = useProfile();
  const { toast } = useToast();
  
  // Profile state
  const [nome, setNome] = useState("");
  const [crmv, setCrmv] = useState("");
  const [ufCrmv, setUfCrmv] = useState("");
  const [telefone, setTelefone] = useState("");
  const [especialidade, setEspecialidade] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  
  // Clinic state
  const [nomeClinica, setNomeClinica] = useState("");
  const [enderecoClinica, setEnderecoClinica] = useState("");
  const [telefoneClinica, setTelefoneClinica] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [savingClinic, setSavingClinic] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  
  // Signature state
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [uploadingSignature, setUploadingSignature] = useState(false);

  // Initialize profile state when data loads
  useEffect(() => {
    if (profile) {
      setNome(profile.nome || "");
      setCrmv(profile.crmv || "");
      setUfCrmv(profile.uf_crmv || "");
      setTelefone(profile.telefone || "");
      setEspecialidade(profile.especialidade || "");
      setSignaturePreview(profile.signature_url || null);
    }
  }, [profile]);

  // Initialize clinic state when data loads
  useEffect(() => {
    if (clinic) {
      setNomeClinica(clinic.nome_fantasia || "");
      setEnderecoClinica(clinic.endereco || "");
      setTelefoneClinica(clinic.telefone || "");
      setLogoPreview(clinic.logo_url || null);
    }
  }, [clinic]);

  const handleSaveProfile = async () => {
    if (!profile) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível carregar seu perfil. Recarregue a página e tente novamente.",
        variant: "destructive",
      });
      return;
    }

    setSavingProfile(true);
    try {
      const { error } = await updateProfile({
        nome,
        crmv,
        uf_crmv: ufCrmv,
        telefone,
        especialidade,
      });

      if (error) throw error;

      toast({
        title: "Dados salvos com sucesso!",
        description: "As informações do veterinário foram atualizadas.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error?.message ?? "Ocorreu um erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setUploadingSignature(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `signature-${profile.user_id}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('clinic-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('clinic-logos')
        .getPublicUrl(fileName);

      const urlWithCacheBuster = `${publicUrl}?t=${Date.now()}`;
      setSignaturePreview(urlWithCacheBuster);

      // Save URL to profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ signature_url: publicUrl })
        .eq("user_id", profile.user_id);

      if (updateError) throw updateError;
      
      toast({
        title: "Assinatura atualizada",
        description: "Sua assinatura digital foi enviada com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar assinatura",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploadingSignature(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clinic) return;

    setUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${clinic.id}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('clinic-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('clinic-logos')
        .getPublicUrl(filePath);

      // Add cache buster to force refresh
      const urlWithCacheBuster = `${publicUrl}?t=${Date.now()}`;
      setLogoPreview(urlWithCacheBuster);

      // Save URL to clinic
      await updateClinic({ logo_url: publicUrl });
      
      toast({
        title: "Logo atualizada",
        description: "A logo da clínica foi enviada com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar logo",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveClinic = async () => {
    if (!clinic) return;
    
    setSavingClinic(true);
    try {
      const { error } = await updateClinic({
        nome_fantasia: nomeClinica,
        endereco: enderecoClinica,
      });

      // Update telefone separately since it's not in the Clinic interface yet
      const { error: telefoneError } = await supabase
        .from("clinics")
        .update({ telefone: telefoneClinica })
        .eq("id", clinic.id);

      if (error || telefoneError) throw error || telefoneError;
      
      toast({
        title: "Clínica atualizada",
        description: "Os dados da clínica foram salvos com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingClinic(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Configurações</h1>
          <p className="text-muted-foreground">Gerencie seus dados e personalize sua clínica.</p>
        </div>

        <Tabs defaultValue="veterinario" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="veterinario" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Dados do Veterinário
            </TabsTrigger>
            <TabsTrigger value="clinica" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Clínica/Hospital
            </TabsTrigger>
          </TabsList>

          <TabsContent value="veterinario" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Dados do Veterinário</CardTitle>
                <CardDescription>
                  Estas informações serão usadas no rodapé do laudo como assinatura digital.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome Completo</Label>
                    <Input
                      id="nome"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Dr. João Silva"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="especialidade">Especialidade</Label>
                    <Input
                      id="especialidade"
                      value={especialidade}
                      onChange={(e) => setEspecialidade(e.target.value)}
                      placeholder="Cardiologia Veterinária"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="crmv">CRMV</Label>
                    <Input
                      id="crmv"
                      value={crmv}
                      onChange={(e) => setCrmv(e.target.value)}
                      placeholder="12345"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="uf_crmv">UF do CRMV</Label>
                    <Select value={ufCrmv} onValueChange={setUfCrmv}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a UF" />
                      </SelectTrigger>
                      <SelectContent>
                        {UF_OPTIONS.map((uf) => (
                          <SelectItem key={uf} value={uf}>
                            {uf}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input
                      id="telefone"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                </div>

                {/* Signature Upload */}
                <div className="space-y-4 pt-4 border-t">
                  <Label>Assinatura Digital</Label>
                  <p className="text-sm text-muted-foreground">
                    Faça upload de uma imagem da sua assinatura para aparecer no laudo PDF.
                  </p>
                  <div className="flex items-start gap-6">
                    <div className="w-48 h-20 border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-muted/50 overflow-hidden">
                      {signaturePreview ? (
                        <img
                          src={signaturePreview}
                          alt="Assinatura digital"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-muted-foreground text-sm">Sem assinatura</span>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="signature-upload"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md cursor-pointer hover:bg-secondary/80 transition-colors"
                      >
                        {uploadingSignature ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        {uploadingSignature ? "Enviando..." : "Enviar Assinatura"}
                      </Label>
                      <input
                        id="signature-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleSignatureUpload}
                        disabled={uploadingSignature}
                      />
                      <p className="text-sm text-muted-foreground">
                        PNG transparente recomendado. Tamanho: ~4cm de largura.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button type="button" onClick={handleSaveProfile} disabled={savingProfile}>
                    {savingProfile && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Salvar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clinica" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Clínica/Hospital</CardTitle>
                <CardDescription>
                  Estas informações aparecerão no cabeçalho do laudo PDF.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Logo Upload */}
                <div className="space-y-4">
                  <Label>Logo da Clínica</Label>
                  <div className="flex items-start gap-6">
                    <div className="w-32 h-32 border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-muted/50 overflow-hidden">
                      {logoPreview ? (
                        <img
                          src={logoPreview}
                          alt="Logo da clínica"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <Building2 className="w-12 h-12 text-muted-foreground" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="logo-upload"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md cursor-pointer hover:bg-secondary/80 transition-colors"
                      >
                        {uploadingLogo ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        {uploadingLogo ? "Enviando..." : "Enviar Logo"}
                      </Label>
                      <input
                        id="logo-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                        disabled={uploadingLogo}
                      />
                      <p className="text-sm text-muted-foreground">
                        PNG, JPG ou SVG. Recomendado: 300x100px
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome_clinica">Nome da Clínica</Label>
                    <Input
                      id="nome_clinica"
                      value={nomeClinica}
                      onChange={(e) => setNomeClinica(e.target.value)}
                      placeholder="Clínica Veterinária Exemplo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefone_clinica">Telefone da Clínica</Label>
                    <Input
                      id="telefone_clinica"
                      value={telefoneClinica}
                      onChange={(e) => setTelefoneClinica(e.target.value)}
                      placeholder="(11) 3333-4444"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endereco_clinica">Endereço Completo</Label>
                  <Input
                    id="endereco_clinica"
                    value={enderecoClinica}
                    onChange={(e) => setEnderecoClinica(e.target.value)}
                    placeholder="Rua Exemplo, 123 - Centro - São Paulo/SP"
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={handleSaveClinic} disabled={savingClinic || uploadingLogo}>
                    {savingClinic && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Salvar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
