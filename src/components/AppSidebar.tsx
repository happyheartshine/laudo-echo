import { FileText, Home, History, Settings, Users, Building2, Wallet } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home
  },
  {
    title: "Novo Exame",
    url: "/novo-exame",
    icon: FileText
  },
  {
    title: "Histórico",
    url: "/historico",
    icon: History
  },
  {
    title: "Parceiros",
    url: "/parceiros",
    icon: Building2
  },
  {
    title: "Financeiro",
    url: "/financeiro",
    icon: Wallet
  }
];

export function AppSidebar() {
  const location = useLocation();
  const { profile, clinic, isGestor } = useProfile();

  return (
    <aside className="w-64 min-h-[calc(100vh-4rem)] bg-sidebar flex flex-col">
      {/* Clinic Name */}
      {clinic && (
        <div className="px-4 py-4 border-b border-sidebar-border">
          <p className="text-xs text-sidebar-foreground/60 uppercase tracking-wider mb-1">
            Clínica
          </p>
          <p className="text-sidebar-foreground truncate font-medium text-lg">
            {clinic.nome_fantasia}
          </p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.url;
          return (
            <NavLink
              key={item.title}
              to={item.url}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.title}</span>
            </NavLink>
          );
        })}

        {/* Configurações */}
        <NavLink
          to="/configuracoes"
          className={`sidebar-link ${location.pathname === '/configuracoes' ? 'active' : ''}`}
        >
          <Settings className="w-5 h-5" />
          <span>Configurações</span>
        </NavLink>

        {/* Minha Equipe - only for Gestor */}
        {isGestor && (
          <NavLink
            to="/minha-equipe"
            className={`sidebar-link ${location.pathname === '/minha-equipe' ? 'active' : ''}`}
          >
            <Users className="w-5 h-5" />
            <span>Equipe</span>
          </NavLink>
        )}
      </nav>
    </aside>
  );
}
