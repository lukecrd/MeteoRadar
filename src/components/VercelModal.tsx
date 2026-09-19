import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Terminal,
  FileCode,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  GitBranch,
  ArrowRight,
  Download
} from 'lucide-react';

interface VercelModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
}

export const VercelModal: React.FC<VercelModalProps> = ({ isOpen, onClose, isDark }) => {
  const [activeTab, setActiveTab] = useState<'quick' | 'github' | 'cli' | 'config'>('quick');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-modal-backdrop">
      <div
        id="vercel-export-modal"
        className={`w-full max-w-2xl rounded-3xl p-6 sm:p-8 border shadow-2xl relative overflow-hidden transition-all max-h-[90vh] overflow-y-auto animate-modal-slide-up ${
          isDark
            ? 'bg-slate-900/95 border-slate-800 text-slate-100 shadow-black/80'
            : 'bg-white border-slate-200 text-slate-900 shadow-slate-300/60'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            {/* Iconic Vercel Triangle Logo */}
            <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center shadow-lg border border-white/20">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 76 65" height="20" width="24">
                <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  Esporta su Vercel
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30">
                  Pre-configurato
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
                Distribuisci la Web App & le Serverless Functions con HTTPS e CDN globale
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-2xl mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('quick')}
            className={`flex-1 min-w-[110px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'quick'
                ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Guida Rapida</span>
          </button>

          <button
            onClick={() => setActiveTab('github')}
            className={`flex-1 min-w-[110px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'github'
                ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Tramite GitHub</span>
          </button>

          <button
            onClick={() => setActiveTab('cli')}
            className={`flex-1 min-w-[110px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'cli'
                ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Vercel CLI</span>
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`flex-1 min-w-[110px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'config'
                ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>File di Config</span>
          </button>
        </div>

        {/* Tab 1: Guida Rapida */}
        {activeTab === 'quick' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-500/10 to-blue-500/10 border border-teal-500/20 text-xs text-slate-700 dark:text-slate-200">
              <h3 className="font-extrabold text-teal-500 dark:text-teal-400 text-sm mb-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                L'applicazione è già pronta per Vercel
              </h3>
              <p className="leading-relaxed">
                Abbiamo creato e configurato automaticamente il file <code className="bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">vercel.json</code> e le funzioni serverless in <code className="bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">/api</code>. Non devi riscrivere o modificare alcun codice!
              </p>
            </div>

            {/* 3 Simple Steps */}
            <div className="space-y-3">
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-start gap-3 bg-slate-50 dark:bg-slate-800/40">
                <div className="w-6 h-6 rounded-full bg-teal-500 text-white font-black text-xs flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Esporta il progetto da Google AI Studio
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    In alto a destra nell'interfaccia di AI Studio, apri il menu delle opzioni e clicca su <strong>"Export to GitHub"</strong> oppure <strong>"Download ZIP"</strong>.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-start gap-3 bg-slate-50 dark:bg-slate-800/40">
                <div className="w-6 h-6 rounded-full bg-teal-500 text-white font-black text-xs flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Importa su Vercel
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    Accedi a <a href="https://vercel.com/new" target="_blank" rel="noreferrer" className="text-teal-400 font-semibold underline inline-flex items-center gap-0.5">vercel.com/new <ExternalLink className="w-3 h-3" /></a> e seleziona il repository GitHub esportato. Vercel rileverà automaticamente Vite come framework!
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-start gap-3 bg-slate-50 dark:bg-slate-800/40">
                <div className="w-6 h-6 rounded-full bg-teal-500 text-white font-black text-xs flex items-center justify-center shrink-0">
                  3
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Aggiungi GEMINI_API_KEY (Facoltativo) e Clicca Deploy
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    Nelle variabili d'ambiente di Vercel puoi inserire <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">GEMINI_API_KEY</code> per la diagnostica predittiva con Gemini. Clicca <strong>Deploy</strong> e il tuo sito sarà online in 30 secondi.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <a
                href="https://vercel.com/new"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition-opacity shadow-lg"
              >
                <span>Apri Vercel Dashboard</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        )}

        {/* Tab 2: Tramite GitHub */}
        {activeTab === 'github' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-2">Procedura Dettagliata GitHub → Vercel:</h4>
              <ol className="space-y-2 list-decimal list-inside text-slate-600 dark:text-slate-300 leading-relaxed">
                <li>Nel menu in alto di AI Studio, seleziona <strong>"Export to GitHub"</strong> per collegare il tuo account GitHub e creare un nuovo repository.</li>
                <li>Vai su <strong>vercel.com</strong> ed effettua l'accesso con il tuo account GitHub.</li>
                <li>Clicca <strong>"Add New..."</strong> &gt; <strong>"Project"</strong>.</li>
                <li>Vedrai comparire il tuo repository: clicca su <strong>"Import"</strong>.</li>
                <li>Le impostazioni sono già pre-configurate grazie al nostro <code className="text-teal-400 font-mono">vercel.json</code>.</li>
                <li>Clicca <strong>"Deploy"</strong>: ogni volta che farai un commit o aggiornamento, Vercel aggiornerà automaticamente la tua app!</li>
              </ol>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 text-slate-200 font-mono text-xs flex items-center justify-between border border-slate-800">
              <div className="truncate">
                <span className="text-slate-500">Preset:</span> Vite &nbsp;|&nbsp;
                <span className="text-slate-500">Output:</span> dist &nbsp;|&nbsp;
                <span className="text-slate-500">Build:</span> vite build
              </div>
              <span className="text-emerald-400 text-[11px] font-bold">100% Compatibile</span>
            </div>
          </div>
        )}

        {/* Tab 3: Vercel CLI */}
        {activeTab === 'cli' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Se hai scaricato lo ZIP del progetto sul tuo computer, puoi distribuirlo istantaneamente tramite la riga di comando:
            </p>

            {/* Command 1 */}
            <div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                1. Installa Vercel CLI:
              </div>
              <div className="p-3 rounded-xl bg-slate-950 text-emerald-400 font-mono text-xs flex items-center justify-between border border-slate-800">
                <code>npm install -g vercel</code>
                <button
                  onClick={() => handleCopy('npm install -g vercel', 'npm-cli')}
                  className="text-slate-400 hover:text-white p-1"
                  title="Copia"
                >
                  {copiedKey === 'npm-cli' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Command 2 */}
            <div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                2. Distribuisci in Produzione:
              </div>
              <div className="p-3 rounded-xl bg-slate-950 text-emerald-400 font-mono text-xs flex items-center justify-between border border-slate-800">
                <code>vercel --prod</code>
                <button
                  onClick={() => handleCopy('vercel --prod', 'vercel-prod')}
                  className="text-slate-400 hover:text-white p-1"
                  title="Copia"
                >
                  {copiedKey === 'vercel-prod' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/40 text-[11px] text-slate-500 dark:text-slate-400">
              La CLI leggerà automaticamente il file <code>vercel.json</code> e pubblicherà la tua applicazione generando un dominio HTTPS gratuito.
            </div>
          </div>
        )}

        {/* Tab 4: File di Config */}
        {activeTab === 'config' && (
          <div className="space-y-3">
            <div className="text-xs text-slate-600 dark:text-slate-300">
              File inclusi nella radice del progetto per supportare Vercel nativamente:
            </div>

            <div className="space-y-2">
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-teal-400" />
                  <span className="font-mono font-bold text-slate-900 dark:text-white">vercel.json</span>
                  <span className="text-slate-400 text-[11px]">Configurazione routing Vite + API</span>
                </div>
                <span className="text-emerald-400 font-semibold text-[11px]">Pronto</span>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-cyan-400" />
                  <span className="font-mono font-bold text-slate-900 dark:text-white">api/weather/predict-changes.ts</span>
                  <span className="text-slate-400 text-[11px]">Serverless Gemini AI</span>
                </div>
                <span className="text-emerald-400 font-semibold text-[11px]">Pronto</span>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-indigo-400" />
                  <span className="font-mono font-bold text-slate-900 dark:text-white">api/health.ts</span>
                  <span className="text-slate-400 text-[11px]">Healthcheck Serverless</span>
                </div>
                <span className="text-emerald-400 font-semibold text-[11px]">Pronto</span>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-amber-400" />
                  <span className="font-mono font-bold text-slate-900 dark:text-white">VERCEL_DEPLOY_GUIDE.md</span>
                  <span className="text-slate-400 text-[11px]">Guida passo-passo</span>
                </div>
                <span className="text-emerald-400 font-semibold text-[11px]">Incluso</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
