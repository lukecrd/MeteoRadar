import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Download,
  CheckCircle2,
  Copy,
  ExternalLink,
  X,
  FileCode,
  Layers,
  Sparkles,
  ShieldCheck,
  Check
} from 'lucide-react';

interface AndroidModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
}

export const AndroidModal: React.FC<AndroidModalProps> = ({ isOpen, onClose, isDark }) => {
  const [activeTab, setActiveTab] = useState<'pwa' | 'flutter' | 'apk' | 'files'>('flutter');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setIsInstallable(false);
      setInstalledSuccess(true);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleInstallPwa = async () => {
    if (!deferredPrompt) {
      alert('Per installare su Android: tocca i 3 puntini in alto a destra su Chrome e seleziona "Aggiungi a schermata Home" / "Installa app".');
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstalledSuccess(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-modal-backdrop">
      <div
        className={`w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-modal-slide-up ${
          isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-teal-500/10 via-cyan-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-teal-500/20">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <span>File & Installazione Android</span>
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-400 border border-teal-500/30">
                  Pronto per Android
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-300">
                PWA Standalone, Configurazione Capacitor APK e TWA per Google Play
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800/80 px-6 pt-2 bg-slate-50 dark:bg-slate-950/40 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('flutter')}
            className={`pb-3 px-3 text-xs font-black border-b-2 transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'flutter'
                ? 'border-teal-400 text-teal-400'
                : 'border-transparent text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Progetto Flutter</span>
          </button>
          <button
            onClick={() => setActiveTab('apk')}
            className={`pb-3 px-3 text-xs font-black border-b-2 transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'apk'
                ? 'border-teal-400 text-teal-400'
                : 'border-transparent text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Android Studio / APK</span>
          </button>
          <button
            onClick={() => setActiveTab('pwa')}
            className={`pb-3 px-3 text-xs font-black border-b-2 transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'pwa'
                ? 'border-teal-400 text-teal-400'
                : 'border-transparent text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Installa PWA</span>
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`pb-3 px-3 text-xs font-black border-b-2 transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'files'
                ? 'border-teal-400 text-teal-400'
                : 'border-transparent text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>File Generati</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {/* TAB 0: Flutter Project */}
          {activeTab === 'flutter' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-teal-200">Progetto Flutter Configurato in <code>/flutter_app</code>!</strong>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Include <code>pubspec.yaml</code>, <code>lib/main.dart</code> (WebView nativa, notifiche, GPS e assets offline) e configurazione Android.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-teal-400">1. Esegui il progetto con Flutter:</div>
                  <div className="relative p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200">
                    <code>cd flutter_app && flutter pub get && flutter run</code>
                    <button
                      onClick={() => handleCopy('cd flutter_app && flutter pub get && flutter run', 'flut1')}
                      className="absolute right-2 top-2 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title="Copia comando"
                    >
                      {copiedKey === 'flut1' ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-teal-400">2. Genera l'APK Release per Android:</div>
                  <div className="relative p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200">
                    <code>cd flutter_app && flutter build apk --release</code>
                    <button
                      onClick={() => handleCopy('cd flutter_app && flutter build apk --release', 'flut2')}
                      className="absolute right-2 top-2 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title="Copia comando"
                    >
                      {copiedKey === 'flut2' ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-teal-400">3. Sincronizza modifiche web verso Flutter:</div>
                  <div className="relative p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200">
                    <code>npm run flutter:sync</code>
                    <button
                      onClick={() => handleCopy('npm run flutter:sync', 'flut3')}
                      className="absolute right-2 top-2 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title="Copia comando"
                    >
                      {copiedKey === 'flut3' ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs flex items-center gap-2">
                <span>📘</span>
                <span>Consulta la guida completa in <strong>FLUTTER_GUIDE.md</strong> per tutte le istruzioni dettagliate.</span>
              </div>
            </div>
          )}
          {/* TAB 1: PWA Direct Android Installation */}
          {activeTab === 'pwa' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-start gap-3.5">
                <ShieldCheck className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-teal-300 text-sm">Pronta per l'installazione su Android</div>
                  <div className="text-xs text-slate-300 leading-relaxed">
                    L'applicazione include il <strong>Web App Manifest</strong>, <strong>Service Worker</strong> con cache offline e l'icona vettoriale adattiva ad alta risoluzione. Funziona a schermo intero senza barre del browser.
                  </div>
                </div>
              </div>

              {/* Install action button */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-3">
                <div className="w-16 h-16 mx-auto rounded-2xl overflow-hidden border border-teal-500/30 shadow-xl shadow-teal-500/10 bg-slate-900 flex items-center justify-center">
                  <img src="/icon.svg" alt="App Icon" className="w-14 h-14" />
                </div>
                <div>
                  <div className="font-black text-base text-slate-100">MeteoRadar 3D & Storm Track</div>
                  <div className="text-xs text-slate-400">Pacchetto: com.meteoradar.italy</div>
                </div>

                <button
                  type="button"
                  onClick={handleInstallPwa}
                  className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-black text-sm shadow-xl shadow-teal-500/25 transition-all inline-flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>{installedSuccess ? 'App Già Installata!' : 'Installa Subito su Android'}</span>
                </button>
              </div>

              {/* Step by step instructions for Android Chrome */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Come installare da Google Chrome su Android:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                    <span className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-400 font-black text-[11px] inline-flex items-center justify-center">1</span>
                    <p className="font-bold text-slate-200">Apri nel browser</p>
                    <p className="text-slate-400 text-[11px]">Apri il link su Google Chrome dal tuo smartphone Android.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                    <span className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-400 font-black text-[11px] inline-flex items-center justify-center">2</span>
                    <p className="font-bold text-slate-200">Menu opzioni (⋮)</p>
                    <p className="text-slate-400 text-[11px]">Tocca i tre puntini in alto a destra nel browser Chrome.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                    <span className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-400 font-black text-[11px] inline-flex items-center justify-center">3</span>
                    <p className="font-bold text-slate-200">Aggiungi a Home</p>
                    <p className="text-slate-400 text-[11px]">Seleziona "Aggiungi a schermata Home" o "Installa app".</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Capacitor Native APK Build */}
          {activeTab === 'apk' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-emerald-200">Pacchetto Android Studio già configurato!</strong>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    La cartella nativa <code>android/</code> con Gradle, Manifest e asset è già pronta nel progetto. Puoi esportare il file ZIP ed aprirla direttamente in Android Studio.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-teal-400">1. Esporta il progetto dal menu in alto a destra:</div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                    Fai clic sul menu delle impostazioni in alto a destra e seleziona <strong>"Export as ZIP"</strong> (o Git push). Estrai lo zip sul tuo PC.
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-teal-400">2. Apri direttamente in Android Studio:</div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                    In Android Studio fai clic su <strong>Open</strong> e seleziona la cartella <code>android/</code> del progetto estratto. Gradle sincronizzerà tutto in automatico!
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-teal-400">3. Comandi da terminale (opzionali per sincronizzare modifiche):</div>
                  <div className="relative p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200">
                    <code>npm install && npm run android:sync && npm run android:open</code>
                    <button
                      onClick={() => handleCopy('npm install && npm run android:sync && npm run android:open', 'cap1')}
                      className="absolute right-2 top-2 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title="Copia comando"
                    >
                      {copiedKey === 'cap1' ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                <span>💡</span>
                <span>In Android Studio fai clic su <strong>Build &gt; Build Bundle(s) / APK(s) &gt; Build APK(s)</strong> per avere il file <code>.apk</code> pronto per l'installazione su qualsiasi telefono! Consulta anche il file <code>ANDROID_STUDIO_GUIDE.md</code>.</span>
              </div>
            </div>
          )}

          {/* TAB 3: Generated Files Inspector */}
          {activeTab === 'files' && (
            <div className="space-y-3 animate-in fade-in">
              <div className="text-xs text-slate-300">
                Tutti i file necessari per Android sono stati configurati e generati con successo:
              </div>

              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <FileCode className="w-4 h-4 text-teal-400" />
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-slate-200">public/manifest.json</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-300">Web App Manifest per Android (display standalone, icone, scorciatoie)</div>
                    </div>
                  </div>
                  <a
                    href="/manifest.json"
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-400 text-xs font-bold flex items-center gap-1"
                  >
                    <span>Vedi</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <FileCode className="w-4 h-4 text-cyan-400" />
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-slate-200">public/sw.js</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-300">Service Worker per caching offline e installabilità Android</div>
                    </div>
                  </div>
                  <a
                    href="/sw.js"
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold flex items-center gap-1"
                  >
                    <span>Vedi</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <FileCode className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-slate-200">public/icon.svg</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-300">Icona dell'applicazione ad alta definizione per schermata home Android</div>
                    </div>
                  </div>
                  <a
                    href="/icon.svg"
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold flex items-center gap-1"
                  >
                    <span>Vedi</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <FileCode className="w-4 h-4 text-amber-400" />
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-slate-200">capacitor.config.json</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-300">File di configurazione nativa Capacitor per build APK & Android Studio</div>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 font-bold">com.meteoradar.italy</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <FileCode className="w-4 h-4 text-indigo-400" />
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-slate-200">twa-manifest.json</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-300">Manifest Trusted Web Activity per pubblicazione su Google Play Store</div>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 font-bold">Bubblewrap TWA</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="text-xs text-slate-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-teal-400" />
            <span>Compatibile con Android 7.0+ (Chrome, Capacitor, TWA)</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
