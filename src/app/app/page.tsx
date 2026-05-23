"use client";

import { PanelLeft } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";

export default function AppPage() {
  const { sidebarVisible, toggleSidebar } = useWorkspace();

  return (
    <div className="flex-1 flex flex-col bg-white min-h-0">
      {/* Minimal topbar with sidebar toggle */}
      <div className="h-11 flex items-center px-3 border-b border-[rgba(55,53,47,0.09)] shrink-0">
        <button
          onClick={toggleSidebar}
          title={sidebarVisible ? "Ocultar barra lateral" : "Mostrar barra lateral"}
          className="p-1.5 rounded-md hover:bg-[rgba(55,53,47,0.08)] text-[#9b9a97] hover:text-[#37352f] transition-colors"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Welcome state */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-sm text-[#9b9a97]">
            Selecione uma página ou crie uma nova
          </p>
          <p className="text-xs text-[#c7c6c3]">
            Use a barra lateral para navegar
          </p>
        </div>
      </div>
    </div>
  );
}
