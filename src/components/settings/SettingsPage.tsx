"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  X,
  User,
  SlidersHorizontal,
  HardDrive,
  LogOut,
  ExternalLink,
  Sun,
  Monitor,
  FileText,
  Info,
  Check,
} from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";

// ── Types ────────────────────────────────────────────────────────────────────

type SectionId = "perfil" | "preferencias" | "geral" | "armazenamento";

interface NavItem {
  id: SectionId;
  label: string;
  icon: React.ElementType;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function useLocalSetting<T extends string>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    return (localStorage.getItem(key) as T) ?? defaultValue;
  });
  function set(next: T) {
    setValue(next);
    localStorage.setItem(key, next);
  }
  return [value, set] as const;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[22px] font-semibold text-[#37352f] mb-0.5">{children}</h2>
  );
}

function SectionSubtitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-[rgba(55,53,47,0.65)] mb-6">{children}</p>
  );
}

function SettingsDivider({ label }: { label: string }) {
  return (
    <div className="mt-8 mb-4">
      <p className="text-base font-semibold text-[#37352f] mb-2">{label}</p>
      <hr className="border-[rgba(55,53,47,0.09)]" />
    </div>
  );
}

function SettingsRow({
  label,
  description,
  control,
}: {
  label: string;
  description?: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-8 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#37352f]">{label}</p>
        {description && (
          <p className="text-xs text-[rgba(55,53,47,0.55)] mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function SelectControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="text-sm border border-[rgba(55,53,47,0.18)] rounded-md px-2.5 py-1.5 bg-white text-[#37352f] outline-none focus:ring-2 focus:ring-[#2383e2] focus:border-transparent cursor-pointer"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        enabled ? "bg-[#2383e2]" : "bg-[rgba(55,53,47,0.18)]"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          enabled ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center py-2.5 border-b border-[rgba(55,53,47,0.06)] last:border-0">
      <span className="text-sm text-[rgba(55,53,47,0.55)] w-48 shrink-0">{label}</span>
      <span className="text-sm text-[#37352f] font-medium truncate">{value}</span>
    </div>
  );
}

// ── Section: Meu Perfil ───────────────────────────────────────────────────────

function ProfileSection({ session }: { session: ReturnType<typeof useSession>["data"] }) {
  return (
    <div>
      <SectionTitle>Meu perfil</SectionTitle>
      <SectionSubtitle>Informações da sua conta Google vinculada.</SectionSubtitle>

      {/* Avatar + info */}
      <div className="flex items-center gap-4 p-4 bg-[rgba(55,53,47,0.03)] rounded-xl border border-[rgba(55,53,47,0.08)] mb-6">
        {session?.user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.user.image}
            alt={session.user.name ?? ""}
            className="w-14 h-14 rounded-full shrink-0 object-cover"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-[#2383e2] flex items-center justify-center shrink-0">
            <span className="text-white text-xl font-bold">
              {(session?.user?.name ?? "N")[0].toUpperCase()}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-[#37352f] truncate">
            {session?.user?.name ?? "Usuário"}
          </p>
          <p className="text-sm text-[rgba(55,53,47,0.55)] truncate">
            {session?.user?.email ?? ""}
          </p>
          <span className="inline-flex items-center gap-1 mt-1 text-xs text-[rgba(55,53,47,0.4)] bg-[rgba(55,53,47,0.06)] px-2 py-0.5 rounded-full">
            <Check className="w-3 h-3" />
            Conta Google vinculada
          </span>
        </div>
      </div>

      <SettingsDivider label="Conta" />
      <div className="space-y-0">
        <InfoRow label="Nome" value={session?.user?.name ?? "—"} />
        <InfoRow label="E-mail" value={session?.user?.email ?? "—"} />
        <InfoRow label="Autenticação" value="OAuth 2.0 · Google" />
      </div>

      <p className="text-xs text-[rgba(55,53,47,0.4)] mt-4">
        Seu nome e foto de perfil são gerenciados pela sua conta Google e não podem ser alterados aqui.
      </p>
    </div>
  );
}

// ── Section: Preferências ─────────────────────────────────────────────────────

function PreferencesSection() {
  const [theme, setTheme] = useLocalSetting<"light" | "dark" | "system">("ndg-theme", "light");
  const [weekStart, setWeekStart] = useLocalSetting<"sunday" | "monday">("ndg-week-start", "sunday");
  const [dateFormat, setDateFormat] = useLocalSetting<"relative" | "absolute" | "verbose">("ndg-date-format", "relative");
  const [showHistory, setShowHistory] = useLocalSetting<"true" | "false">("ndg-show-history", "true");

  return (
    <div>
      <SectionTitle>Preferências</SectionTitle>
      <SectionSubtitle>Personalize como o Notes do Google se comporta neste dispositivo.</SectionSubtitle>

      {/* ── Aparência ── */}
      <SettingsDivider label="Aparência" />
      <SettingsRow
        label="Tema"
        description="Escolha um tema para este dispositivo."
        control={
          <SelectControl
            value={theme}
            onChange={setTheme}
            options={[
              { value: "light", label: "☀️  Claro" },
              { value: "dark", label: "🌙  Escuro (em breve)", disabled: true },
              { value: "system", label: "🖥  Usar configuração do sistema", disabled: true },
            ]}
          />
        }
      />

      {/* ── Idioma e hora ── */}
      <SettingsDivider label="Idioma e hora" />
      <SettingsRow
        label="Idioma"
        description="Idioma utilizado na interface do aplicativo."
        control={
          <SelectControl
            value={"pt-BR" as string}
            onChange={() => {}}
            options={[
              { value: "pt-BR", label: "Português (BR)" },
              { value: "en-US", label: "English (US) — em breve", disabled: true },
            ]}
          />
        }
      />
      <SettingsRow
        label="Início da semana"
        description="Define o primeiro dia da semana nos calendários."
        control={
          <SelectControl
            value={weekStart}
            onChange={setWeekStart}
            options={[
              { value: "sunday", label: "Domingo" },
              { value: "monday", label: "Segunda-feira" },
            ]}
          />
        }
      />
      <SettingsRow
        label="Formato de data"
        description="Define como as datas são exibidas nas propriedades."
        control={
          <SelectControl
            value={dateFormat}
            onChange={setDateFormat}
            options={[
              { value: "relative", label: "Relativo (22 de mai.)" },
              { value: "absolute", label: "Absoluto (22/05/2026)" },
              { value: "verbose", label: "Completo (22 de maio de 2026)" },
            ]}
          />
        }
      />
      <SettingsRow
        label="Fuso horário"
        description="As datas são exibidas no fuso horário do seu navegador."
        control={
          <span className="text-sm text-[rgba(55,53,47,0.55)] bg-[rgba(55,53,47,0.05)] px-3 py-1.5 rounded-md">
            {Intl.DateTimeFormat().resolvedOptions().timeZone}
          </span>
        }
      />

      {/* ── Privacidade ── */}
      <SettingsDivider label="Privacidade" />
      <SettingsRow
        label="Mostrar histórico de visualizações"
        description="Permite que outros vejam quando você acessou uma página compartilhada."
        control={
          <Toggle
            enabled={showHistory === "true"}
            onChange={(v) => setShowHistory(v ? "true" : "false")}
          />
        }
      />
    </div>
  );
}

// ── Section: Geral ────────────────────────────────────────────────────────────

function GeneralSection({ manifest }: { manifest: ReturnType<typeof useWorkspace>["manifest"] }) {
  return (
    <div>
      <SectionTitle>Geral</SectionTitle>
      <SectionSubtitle>Informações gerais sobre o seu workspace.</SectionSubtitle>

      <SettingsDivider label="Workspace" />
      <div className="space-y-0">
        <InfoRow label="Nome" value="Notes do Google" />
        <InfoRow label="ID do workspace" value={manifest?.workspaceId ?? "—"} />
        <InfoRow label="Versão do índice" value={manifest ? `v${manifest.version}` : "—"} />
        <InfoRow
          label="Criado em"
          value={
            manifest?.createdAt
              ? new Date(manifest.createdAt).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })
              : "—"
          }
        />
      </div>

      <SettingsDivider label="Sobre o aplicativo" />
      <div className="space-y-0">
        <InfoRow label="Versão" value="1.0.0" />
        <InfoRow label="Motor do editor" value="BlockNote v0.20" />
        <InfoRow label="Autenticação" value="NextAuth v5 · Google OAuth" />
        <InfoRow label="Framework" value="Next.js 16 (App Router)" />
      </div>
    </div>
  );
}

// ── Section: Armazenamento ────────────────────────────────────────────────────

function StorageSection({ manifest }: { manifest: ReturnType<typeof useWorkspace>["manifest"] }) {
  function openDrive(folderId: string) {
    window.open(`https://drive.google.com/drive/folders/${folderId}`, "_blank");
  }

  return (
    <div>
      <SectionTitle>Armazenamento</SectionTitle>
      <SectionSubtitle>
        Todos os seus dados são armazenados exclusivamente no seu Google Drive. Nenhum servidor externo guarda suas notas.
      </SectionSubtitle>

      {/* Callout */}
      <div className="flex items-start gap-3 bg-[rgba(35,131,226,0.06)] border border-[rgba(35,131,226,0.2)] rounded-xl px-4 py-3 mb-6">
        <Info className="w-4 h-4 text-[#2383e2] shrink-0 mt-0.5" />
        <p className="text-sm text-[rgba(55,53,47,0.75)] leading-relaxed">
          Suas notas são salvas como arquivos <strong>.json</strong> e <strong>.md</strong> na pasta <em>Notes do Google</em> no seu Drive. Você pode acessar, exportar ou fazer backup deles diretamente pelo Google Drive.
        </p>
      </div>

      <SettingsDivider label="Estrutura de pastas" />
      <div className="space-y-0">
        <InfoRow label="Formato das notas" value="JSON + Markdown" />
        <InfoRow label="Imagens e anexos" value="Google Drive" />
        <InfoRow label="Índice" value="index.json (Drive)" />
        <InfoRow label="Configurações" value="manifest.json (Drive)" />
      </div>

      {manifest && (
        <>
          <SettingsDivider label="IDs das pastas (Google Drive)" />
          <div className="space-y-0">
            <InfoRow label="Pasta raiz" value={manifest.rootFolderId} />
            <InfoRow label="Pasta de notas" value={manifest.notesFolderId} />
            <InfoRow label="Pasta markdown" value={manifest.markdownFolderId} />
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => openDrive(manifest.rootFolderId)}
              className="flex items-center gap-2 text-sm text-[#2383e2] hover:text-[#1a6fc4] transition-colors w-fit"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir pasta raiz no Google Drive
            </button>
            <button
              onClick={() => openDrive(manifest.notesFolderId)}
              className="flex items-center gap-2 text-sm text-[#2383e2] hover:text-[#1a6fc4] transition-colors w-fit"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir pasta de notas no Google Drive
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function SettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { manifest } = useWorkspace();

  const [active, setActive] = useState<SectionId>("preferencias");

  const navGroups: { label: string; items: NavItem[] }[] = [
    {
      label: "Conta",
      items: [
        { id: "perfil", label: session?.user?.name ?? "Meu perfil", icon: User },
        { id: "preferencias", label: "Preferências", icon: SlidersHorizontal },
      ],
    },
    {
      label: "Workspace",
      items: [
        { id: "geral", label: "Geral", icon: Info },
        { id: "armazenamento", label: "Armazenamento", icon: HardDrive },
      ],
    },
  ];

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* ── Left nav ── */}
      <div
        className="w-60 shrink-0 flex flex-col py-4 overflow-y-auto"
        style={{ background: "#f7f6f5" }}
      >
        <div className="flex-1 px-2">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="px-2 pb-1 text-[11px] font-semibold text-[#9b9a97] uppercase tracking-wider">
                {group.label}
              </p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = active === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActive(item.id)}
                    className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors text-left ${
                      isActive
                        ? "bg-white shadow-sm text-[#37352f] font-medium"
                        : "text-[rgba(55,53,47,0.65)] hover:bg-[rgba(55,53,47,0.08)]"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Sign out */}
        <div className="px-2 pt-2 border-t border-[rgba(55,53,47,0.09)]">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Desconectar</span>
          </button>
        </div>
      </div>

      {/* ── Right content ── */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Close button */}
        <button
          onClick={() => router.push("/app")}
          className="absolute top-4 right-4 z-10 p-1.5 rounded-md hover:bg-[rgba(55,53,47,0.08)] text-[#9b9a97] hover:text-[#37352f] transition-colors"
          title="Fechar configurações"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-16 py-12">
            {active === "perfil" && <ProfileSection session={session} />}
            {active === "preferencias" && <PreferencesSection />}
            {active === "geral" && <GeneralSection manifest={manifest} />}
            {active === "armazenamento" && <StorageSection manifest={manifest} />}
          </div>
        </div>

        {/* Storage badge at bottom */}
        <div className="shrink-0 flex items-center justify-center gap-2 py-3 border-t border-[rgba(55,53,47,0.06)]">
          <FileText className="w-3.5 h-3.5 text-[#9b9a97]" />
          <span className="text-xs text-[#9b9a97]">
            Dados armazenados no Google Drive · Nenhum servidor externo
          </span>
        </div>
      </div>
    </div>
  );
}
