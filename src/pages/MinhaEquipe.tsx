import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Mail, Trash2, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TeamMember {
  id: string;
  nome: string;
  cargo: string;
  telefone: string | null;
  crmv: string | null;
  uf_crmv: string | null;
}

interface Invite {
  id: string;
  email: string;
  cargo: string;
  accepted: boolean;
  created_at: string;
}

export default function MinhaEquipe() {
  const { profile, clinic, isGestor } = useProfile();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCargo, setInviteCargo] = useState<"veterinario" | "gestor">("veterinario");
  const [sending, setSending] = useState(false);

  const fetchTeamData = async () => {
    if (!clinic) return;
    
    setLoading(true);
    try {
      // Fetch team members
      const { data: membersData, error: membersError } = await supabase
        .from("profiles")
        .select("id, nome, cargo, telefone, crmv, uf_crmv")
        .eq("clinic_id", clinic.id);

      if (membersError) throw membersError;
      setMembers(membersData || []);

      // Fetch pending invites
      const { data: invitesData, error: invitesError } = await supabase
        .from("team_invites")
        .select("*")
        .eq("clinic_id", clinic.id)
        .eq("accepted", false);

      if (invitesError) throw invitesError;
      setInvites(invitesData || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar equipe",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clinic) {
      fetchTeamData();
    }
  }, [clinic]);

  const handleInvite = async () => {
    if (!inviteEmail || !clinic || !user) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from("team_invites")
        .insert({
          email: inviteEmail.toLowerCase().trim(),
          clinic_id: clinic.id,
          cargo: inviteCargo,
          invited_by: user.id,
        });

      if (error) throw error;

      toast({
        title: "Convite enviado",
        description: `Um convite foi criado para ${inviteEmail}. O usuário será adicionado à clínica ao criar uma conta.`,
      });

      setInviteEmail("");
      setDialogOpen(false);
      fetchTeamData();
    } catch (error: any) {
      toast({
        title: "Erro ao enviar convite",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    try {
      const { error } = await supabase
        .from("team_invites")
        .delete()
        .eq("id", inviteId);

      if (error) throw error;

      toast({
        title: "Convite removido",
        description: "O convite foi cancelado com sucesso.",
      });

      fetchTeamData();
    } catch (error: any) {
      toast({
        title: "Erro ao remover convite",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getCargoLabel = (cargo: string) => {
    switch (cargo) {
      case "gestor":
        return "Gestor";
      case "veterinario":
        return "Veterinário";
      case "super_admin":
        return "Super Admin";
      default:
        return cargo;
    }
  };

  const getCargoVariant = (cargo: string): "default" | "secondary" | "outline" => {
    switch (cargo) {
      case "gestor":
      case "super_admin":
        return "default";
      case "veterinario":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (!isGestor) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Users className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold text-foreground">Acesso Restrito</h2>
          <p className="text-muted-foreground">Apenas gestores podem acessar esta página.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Minha Equipe</h1>
            <p className="text-muted-foreground">Gerencie os membros da sua clínica.</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="w-4 h-4 mr-2" />
                Convidar Veterinário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Convidar Membro</DialogTitle>
                <DialogDescription>
                  Envie um convite para um novo membro se juntar à sua clínica.
                  Ao criar uma conta com este email, ele será automaticamente vinculado.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="veterinario@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cargo">Cargo</Label>
                  <Select value={inviteCargo} onValueChange={(v) => setInviteCargo(v as "veterinario" | "gestor")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="veterinario">Veterinário</SelectItem>
                      <SelectItem value="gestor">Gestor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleInvite} disabled={sending || !inviteEmail}>
                  {sending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Enviar Convite
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Team Members */}
            <Card>
              <CardHeader>
                <CardTitle>Membros da Equipe</CardTitle>
                <CardDescription>
                  Todos os usuários vinculados à clínica {clinic?.nome_fantasia}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CRMV</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Cargo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          {member.nome}
                          {member.id === profile?.id && (
                            <span className="ml-2 text-xs text-muted-foreground">(você)</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {member.crmv && member.uf_crmv
                            ? `${member.crmv}/${member.uf_crmv}`
                            : "-"}
                        </TableCell>
                        <TableCell>{member.telefone || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={getCargoVariant(member.cargo)}>
                            {getCargoLabel(member.cargo)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {members.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          Nenhum membro encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Pending Invites */}
            {invites.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Convites Pendentes</CardTitle>
                  <CardDescription>
                    Convites aguardando aceitação.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Enviado em</TableHead>
                        <TableHead className="w-[100px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invites.map((invite) => (
                        <TableRow key={invite.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-muted-foreground" />
                              {invite.email}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {getCargoLabel(invite.cargo)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(invite.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
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
          </div>
        )}
      </div>
    </Layout>
  );
}
