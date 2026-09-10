# 🚀 Guida all'Esportazione e Distribuzione su Vercel

Questa applicazione è **pre-configurata al 100%** per essere distribuita su [Vercel](https://vercel.com) come Single Page Application ad alte prestazioni (Vite + React + Tailwind CSS) con supporto completo per le **Serverless Functions** Vercel per la diagnostica AI meteo (`/api/weather/predict-changes` e `/api/health`).

---

## 📦 Metodo 1: Esportazione tramite GitHub (Consigliato)

1. **Esporta il codice da Google AI Studio:**
   - Clicca sull'icona delle impostazioni in alto a destra o sul menu dell'applet.
   - Seleziona **"Export to GitHub"** (oppure **"Download ZIP"**).
   - Se hai scaricato lo ZIP, scompattalo e caricalo su un tuo repository GitHub personale (es. `meteo-radar-italia`).

2. **Collega a Vercel:**
   - Vai su [vercel.com](https://vercel.com) ed effettua l'accesso (puoi accedere con il tuo account GitHub).
   - Clicca sul pulsante **"Add New..."** → **"Project"**.
   - Clicca su **"Import"** accanto al repository GitHub del progetto appena creato.

3. **Configurazione del Progetto su Vercel:**
   - **Framework Preset:** `Vite` (Vercel lo rileva automaticamente).
   - **Root Directory:** `./`
   - **Build Command:** `vite build` (già specificato in `vercel.json`).
   - **Output Directory:** `dist` (già specificato in `vercel.json`).

4. **Variabili d'Ambiente (Environment Variables):**
   - Nel pannello **"Environment Variables"**, aggiungi (facoltativo ma consigliato per l'AI):
     - **Name:** `GEMINI_API_KEY`
     - **Value:** La tua chiave API di Google Gemini (se non la inserisci, l'app funzionerà comunque perfettamente grazie al motore predittivo locale barometrico integrato).

5. **Deploy:**
   - Clicca su **"Deploy"**. In circa 30-45 secondi il tuo sito sarà live con HTTPS gratuito e CDN globale (es. `tuo-meteo.vercel.app`).

---

## ⚡ Metodo 2: Distribuzione Immediata da CLI (Riga di comando)

Se hai scaricato il progetto in locale sul tuo computer, puoi distribuirlo in pochi secondi con la CLI ufficiale di Vercel:

```bash
# 1. Installa Vercel CLI globalmente (se non lo hai già)
npm install -g vercel

# 2. Posizionati nella cartella del progetto
cd meteo-radar-italia

# 3. Lancia il comando di deploy
vercel
```

Segui le 4 brevi domande interattive (premi Invio per confermare i valori predefiniti rilevati automaticamente).

Per distribuire direttamente in produzione:
```bash
vercel --prod
```

---

## ⚙️ Dettagli Tecnici dei File Inclusi per Vercel

Il repository include già tutti i file necessari:

1. **`vercel.json`**:
   - Imposta il framework Vite.
   - Configura la cartella di output `dist`.
   - Gestisce i rewrite per indirizzare le chiamate a `/api/*` alle Serverless Functions e tutte le altre rotte a `/index.html` (SPA fallback).

2. **`/api/health.ts`**:
   - Endpoint Serverless di monitoraggio dello stato di salute del backend.

3. **`/api/weather/predict-changes.ts`**:
   - Serverless Function per le analisi meteo predittive con Google Gemini AI e fallback automatico in caso di assenza della chiave.

4. **API Open-Meteo & Radar EUMETSAT**:
   - Tutte le chiamate alle telemetrie atmosferiche e radar funzionano direttamente via browser con HTTPS e CORS aperti senza necessità di chiavi a pagamento.
