import { FileText, Home, History, Settings, User, LogOut, Users, Building2 } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import logoVitaecor from "@/assets/logo-vitaecor.png";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
const menuItems = [{
  title: "Dashboard",
  url: "/",
  icon: Home
}, {
  title: "Novo Exame",
  url: "/novo-exame",
  icon: FileText
}, {
  title: "Histórico",
  url: "/historico",
  icon: History
}, {
  title: "Clínicas & Parceiros",
  url: "/clinicas-parceiros",
  icon: Building2
}];
export function AppSidebar() {
  const location = useLocation();
  const {
    signOut,
    user
  } = useAuth();
  const {
    profile,
    clinic,
    isGestor
  } = useProfile();
  const handleLogout = async () => {
    await signOut();
  };
  return <aside className="w-64 min-h-screen bg-sidebar flex flex-col">
      {/* Logo */}
      <div className="p-6 flex items-center justify-center border-b border-sidebar-border">
        <img src={logoVitaecor} alt="VitaeCor - Cardiologia Veterinária" className="h-16 w-auto brightness-0 invert" />
      </div>

      {/* Clinic Name */}
      {clinic && <div className="px-4 py-3 border-b border-sidebar-border">
          <p className="text-xs text-sidebar-foreground/60 uppercase tracking-wider">Clínica</p>
          <p className="text-sidebar-foreground truncate text-xl font-normal">{clinic.nome_fantasia}</p>
        </div>}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map(item => {
        const isActive = location.pathname === item.url;
        return <NavLink key={item.title} to={item.url} className={`sidebar-link ${isActive ? 'active' : ''}`}>
              <item.icon className="w-5 h-5" />
              <span>{item.title}</span>
            </NavLink>;
      })}

        {/* Configurações */}
        <NavLink to="/configuracoes" className={`sidebar-link ${location.pathname === '/configuracoes' ? 'active' : ''}`}>
          <Settings className="w-5 h-5" />
          <span>Configurações</span>
        </NavLink>

        {/* Minha Equipe - only for Gestor */}
        {isGestor && <NavLink to="/minha-equipe" className={`sidebar-link ${location.pathname === '/minha-equipe' ? 'active' : ''}`}>
            <Users className="w-5 h-5" />
            <span>Equipe</span>
          </NavLink>}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border space-y-3">
        <div className="sidebar-link">
          <User className="w-5 h-5" />
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-medium truncate">{profile?.nome || user?.email}</span>
            <span className="text-xs text-sidebar-foreground/60 capitalize">
              {profile?.cargo === 'gestor' ? 'Gestor' : profile?.cargo === 'veterinario' ? 'Veterinário' : profile?.cargo === 'super_admin' ? 'Super Admin' : ''}
            </span>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          Sair
        </Button>
      </div>
    </aside>;
}