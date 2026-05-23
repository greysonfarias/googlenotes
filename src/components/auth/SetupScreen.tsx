"use client";

import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Loader2,
  CheckCircle,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  AlertTriangle,
  Info,
  HardDrive,
} from "lucide-react";

interface SetupScreenProps {
  onComplete: () => void;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function getOrigin(): string {
  if (typeof window === "undefined") return "http://localhost:3000";
  return window.location.origin;
}

function isValidClientId(id: string): boolean {
  return /^\d+-[a-zA-Z0-9_]+\.apps\.googleusercontent\.com$/.test(id.trim());
}

// ─── sub-components ───────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all shrink-0"
    >
      {copied ? (
        <><Check className="w-3 h-3 text-green-500" /><span className="text-green-600">Copiado!</span></>
      ) : (
        <><Copy className="w-3 h-3" /><span>Copiar</span></>
      )}
    </button>
  );
}

function StepLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
    >
      {label}
      <ExternalLink className="w-3 h-3" />
    </a>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 leading-relaxed">
      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800 leading-relaxed">
      <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

function Step({
  number,
  title,
  children,
  defaultOpen = false,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
          {number}
        </span>
        <span className="flex-1 text-sm font-medium text-gray-800">{title}</span>
        {open
          ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
          : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
        }
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3 bg-gray-50/50">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function SetupScreen({ onComplete }: SetupScreenProps) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const redirectUri = `${getOrigin()}/api/auth/callback/google`;
  const clientIdValid = clientId.trim() === "" || isValidClientId(clientId);
  const canSave = isValidClientId(clientId) && clientSecret.trim().length > 0;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/setup/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googleClientId: clientId.trim(),
          googleClientSecret: clientSecret.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erro ao salvar."); return; }
      setDone(true);
      setTimeout(onComplete, 1500);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
          <p className="text-gray-700 font-medium">Configurado com sucesso!</p>
          <p className="text-sm text-gray-400">Redirecionando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-xl space-y-6">

        {/* ── Header ── */}
        <div className="text-center space-y-1.5">
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center">
              <HardDrive className="w-6 h-6 text-gray-700" />
            </div>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">
            Conectar ao Google Drive
          </h1>
          <p className="text-sm text-gray-500">
            Siga os passos abaixo para criar suas credenciais OAuth.{" "}
            <span className="font-medium text-gray-700">Leva ~5 minutos.</span>
          </p>
        </div>

        {/* ── Redirect URI — highlighted upfront ── */}
        {/*
          Shown BEFORE the steps because o usuário vai precisar dela
          no passo 5 e precisa saber onde copiar.
        */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            URI de redirecionamento autorizado
          </p>
          <p className="text-xs text-gray-500 leading-relaxed">
            Você vai precisar colar este endereço no Google Cloud Console (passo 5).
            Copie agora para ter em mãos.
          </p>
          <div className="flex items-center gap-2 mt-1">
            <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono text-gray-800 break-all select-all">
              {redirectUri}
            </code>
            <CopyButton text={redirectUri} />
          </div>
          <Warning>
            Este endereço precisa ser colado <strong>exatamente como está</strong> — qualquer diferença (barra no final, http vs https, porta errada) vai causar erro de autenticação.
          </Warning>
        </div>

        {/* ── Step-by-step guide ── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
            Passo a passo
          </p>

          {/* Step 1 */}
          <Step number={1} title="Criar (ou selecionar) um projeto" defaultOpen>
            <p className="text-sm text-gray-600 leading-relaxed">
              No Google Cloud Console, crie um projeto novo. Pode nomear como quiser — ex: <strong>Notes do Google</strong>. Se já tiver um projeto pessoal, pode reutilizá-lo.
            </p>
            <StepLink
              href="https://console.cloud.google.com/projectcreate"
              label="Criar projeto"
            />
          </Step>

          {/* Step 2 */}
          <Step number={2} title="Ativar a Google Drive API">
            <p className="text-sm text-gray-600 leading-relaxed">
              Acesse a biblioteca de APIs, busque por <strong>"Google Drive API"</strong> e clique em <strong>Ativar</strong>. Certifique-se que o projeto correto está selecionado no topo da página.
            </p>
            <Tip>
              Atenção: existe também a "Google Drive Activity API" — essa <strong>não</strong> é a correta. A que você quer é simplesmente <strong>Google Drive API</strong>.
            </Tip>
            <StepLink
              href="https://console.cloud.google.com/apis/library/drive.googleapis.com"
              label="Ativar Drive API"
            />
          </Step>

          {/* Step 3 */}
          <Step number={3} title="Configurar a tela de consentimento OAuth">
            <p className="text-sm text-gray-600 leading-relaxed">
              Vá em <strong>Tela de consentimento OAuth</strong>. Selecione <strong>Externo</strong> e clique em Criar.
            </p>
            <Tip>
              <strong>Externo</strong> significa que o app funciona com qualquer conta Google — incluindo a sua. <strong>Interno</strong> só funciona com contas de um Google Workspace corporativo.
            </Tip>
            <p className="text-sm text-gray-600 leading-relaxed">
              Preencha os campos obrigatórios:
            </p>
            <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc leading-relaxed">
              <li><strong>Nome do app:</strong> Notes do Google (ou qualquer nome)</li>
              <li><strong>E-mail de suporte:</strong> seu e-mail pessoal</li>
              <li><strong>E-mail do desenvolvedor:</strong> seu e-mail pessoal</li>
            </ul>
            <p className="text-sm text-gray-600">Clique em <strong>Salvar e continuar</strong>.</p>
            <StepLink
              href="https://console.cloud.google.com/apis/credentials/consent"
              label="Abrir tela de consentimento"
            />
          </Step>

          {/* Step 4 */}
          <Step number={4} title="Adicionar o escopo drive.file">
            <p className="text-sm text-gray-600 leading-relaxed">
              Ainda na configuração do consentimento, vá para a seção <strong>Acesso a dados</strong> (ou "Escopos") e clique em <strong>Adicionar ou remover escopos</strong>.
            </p>
            <p className="text-sm text-gray-600 leading-relaxed">
              No campo de busca, digite <code className="bg-gray-100 px-1 rounded font-mono text-xs">drive.file</code> e marque o escopo:
            </p>
            <div className="px-3 py-2 bg-gray-100 rounded-lg border border-gray-200 font-mono text-xs text-gray-700 break-all select-all">
              .../auth/drive.file
            </div>
            <Tip>
              <strong>Por que drive.file e não drive?</strong> O escopo <code>drive.file</code> dá acesso apenas aos arquivos criados por este app — mais seguro e com menos permissões do que acesso total ao Drive.
            </Tip>
            <p className="text-sm text-gray-600">Clique em <strong>Atualizar</strong> e depois em <strong>Salvar e continuar</strong>.</p>
          </Step>

          {/* Step 5 */}
          <Step number={5} title="Adicionar você como usuário de teste">
            <p className="text-sm text-gray-600 leading-relaxed">
              Na seção <strong>Usuários de teste</strong>, clique em <strong>+ Add users</strong> e adicione o e-mail da sua conta Google que vai usar o app.
            </p>
            <Warning>
              <strong>Este passo é crítico.</strong> Se você não adicionar sua conta como usuário de teste, o login vai falhar com erro "Acesso bloqueado". O app fica em modo de teste até ser publicado — o que não é necessário para uso pessoal.
            </Warning>
            <p className="text-sm text-gray-600">Clique em <strong>Salvar e continuar</strong> até finalizar.</p>
          </Step>

          {/* Step 6 */}
          <Step number={6} title="Criar a credencial OAuth (Client ID e Secret)">
            <p className="text-sm text-gray-600 leading-relaxed">
              Vá em <strong>Credenciais</strong> → <strong>Criar credenciais</strong> → <strong>ID do cliente OAuth</strong>.
            </p>
            <ul className="text-sm text-gray-600 space-y-1.5 ml-4 list-disc leading-relaxed">
              <li>Tipo de aplicativo: <strong>Aplicativo da Web</strong></li>
              <li>Nome: qualquer nome (ex: <em>Notes do Google Web</em>)</li>
              <li>
                URIs de redirecionamento autorizados: clique em <strong>+ Adicionar URI</strong> e cole o endereço que está no topo desta página:
                <div className="mt-1.5 flex items-center gap-2">
                  <code className="flex-1 px-2 py-1.5 bg-gray-100 rounded-lg text-xs font-mono text-gray-700 break-all select-all border border-gray-200">
                    {redirectUri}
                  </code>
                  <CopyButton text={redirectUri} />
                </div>
              </li>
            </ul>
            <p className="text-sm text-gray-600">Clique em <strong>Criar</strong>.</p>
            <Warning>
              Um pop-up aparecerá com o <strong>Client ID</strong> e o <strong>Client Secret</strong>. Copie os dois agora — o Secret só é exibido uma vez. Se fechar sem copiar, será necessário criar um novo.
            </Warning>
            <StepLink
              href="https://console.cloud.google.com/apis/credentials"
              label="Ir para Credenciais"
            />
          </Step>
        </div>

        {/* ── Form ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
          <p className="text-sm font-semibold text-gray-800">
            Cole aqui as credenciais criadas
          </p>

          {/* Client ID */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
              Client ID
            </label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="123456789012-abc...xyz.apps.googleusercontent.com"
              className={`w-full px-3 py-2.5 text-sm border rounded-lg outline-none transition-colors font-mono placeholder:text-gray-300 ${
                !clientIdValid
                  ? "border-red-300 focus:border-red-400 bg-red-50"
                  : clientId && isValidClientId(clientId)
                    ? "border-green-300 focus:border-green-400 bg-green-50/30"
                    : "border-gray-200 focus:border-blue-400"
              }`}
            />
            {!clientIdValid && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Formato incorreto. Deve terminar em <code>.apps.googleusercontent.com</code>
              </p>
            )}
            {clientId && isValidClientId(clientId) && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Formato válido
              </p>
            )}
          </div>

          {/* Client Secret */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
              Client Secret
            </label>
            <div className="relative">
              <input
                type={showSecret ? "text" : "password"}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="GOCSPX-..."
                className="w-full px-3 py-2.5 pr-10 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 placeholder:text-gray-300 font-mono transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                title={showSecret ? "Ocultar" : "Mostrar"}
              >
                {showSecret
                  ? <EyeOff className="w-4 h-4" />
                  : <Eye className="w-4 h-4" />
                }
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Começa com <code className="font-mono">GOCSPX-</code> nas credenciais mais recentes.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSave}
            disabled={saving || !canSave}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Salvar e continuar
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* ── Footer note ── */}
        <p className="text-xs text-center text-gray-400 pb-4">
          As credenciais ficam salvas apenas no servidor local — nunca enviadas a terceiros.
        </p>
      </div>
    </div>
  );
}
