import { AppSidebar } from "./AppSidebar";
import { Header } from "./Header";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen w-full bg-background">
      {/* Header fixo no topo */}
      <Header />
      
      {/* Container principal abaixo do header */}
      <div className="flex pt-16">
        <AppSidebar />
        <main className="flex-1 p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
