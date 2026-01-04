import { FileText, Home, History, Settings, User } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import logoVitaecor from "@/assets/logo-vitaecor.png";

const menuItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Novo Exame", url: "/novo-exame", icon: FileText },
  { title: "Histórico", url: "/historico", icon: History },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 min-h-screen bg-sidebar flex flex-col">
      {/* Logo */}
      <div className="p-6 flex items-center justify-center border-b border-sidebar-border">
        <img 
          src={logoVitaecor} 
          alt="VitaeCor - Cardiologia Veterinária" 
          className="h-16 w-auto brightness-0 invert"
        />
      </div>

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
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="sidebar-link">
          <User className="w-5 h-5" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">Dr. Veterinário</span>
            <span className="text-xs text-sidebar-foreground/60">CRMV-SP 12345</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
