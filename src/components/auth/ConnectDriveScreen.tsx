"use client";

import { signIn } from "next-auth/react";
import { HardDrive, Lock, FileText, FolderOpen } from "lucide-react";

export function ConnectDriveScreen() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
            <HardDrive className="w-8 h-8 text-gray-600" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-gray-900">
            Conectar Google Drive
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Suas notas serão armazenadas diretamente no seu Google Drive.
          </p>
        </div>

        <button
          onClick={() => signIn("google", { callbackUrl: "/app" })}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continuar com Google
        </button>

        <div className="grid grid-cols-2 gap-3 text-left">
          {[
            {
              icon: HardDrive,
              text: "Google Drive é a base de dados",
            },
            {
              icon: FolderOpen,
              text: "Seus arquivos continuam com você",
            },
            {
              icon: Lock,
              text: "Sem banco de dados externo",
            },
            {
              icon: FileText,
              text: "Notas em JSON + Markdown",
            },
          ].map(({ icon: Icon, text }) => (
            <div
              key={text}
              className="flex items-start gap-2 p-3 rounded-lg bg-gray-50 border border-gray-100"
            >
              <Icon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <span className="text-xs text-gray-500 leading-snug">{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
