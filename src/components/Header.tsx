import { Settings, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logoVitaecorHorizontal from "@/assets/logo-vitaecor-horizontal.png";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { profile, clinic } = useProfile();

  const handleLogout = async () => {
    await signOut();
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const displayName = profile?.nome || user?.email || "Usuário";
  const firstName = displayName.split(" ")[0];
  const companyName = clinic?.nome_fantasia || "VitaeCor";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-card border-b border-border shadow-sm">
      <div className="flex items-center justify-between h-full px-6">
        {/* Logo à esquerda */}
        <div className="flex items-center">
          <img
            src={logoVitaecorHorizontal}
            alt="VitaeCor - Cardiologia Veterinária"
            className="h-10 w-auto"
          />
        </div>

        {/* Menu do usuário à direita */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-3 hover:bg-muted rounded-lg px-3 py-2 transition-colors outline-none">
            <Avatar className="h-9 w-9">
              <AvatarImage 
                src={(profile as any)?.avatar_url || ""} 
                alt={displayName} 
              />
              <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-foreground hidden sm:block whitespace-nowrap">
              {firstName} | {companyName}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => navigate("/configuracoes")}>
              <Settings className="mr-2 h-4 w-4" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
