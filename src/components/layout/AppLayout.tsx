import { ReactNode } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileBottomNav } from "@/components/dashboard/MobileBottomNav";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <main className="flex-1 overflow-y-auto pb-20">
          {children}
        </main>
        <MobileBottomNav />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
