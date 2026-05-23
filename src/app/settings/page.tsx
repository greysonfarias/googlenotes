import { WorkspaceProvider } from "@/lib/workspace-context";
import { SettingsPage } from "@/components/settings/SettingsPage";

export default function Settings() {
  return (
    <WorkspaceProvider>
      <SettingsPage />
    </WorkspaceProvider>
  );
}
