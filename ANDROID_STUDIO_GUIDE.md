# 📱 Guida per Aprire e Modificare MeteoRadar in Android Studio

Questo progetto include già la cartella e la configurazione nativa **Android** (`/android`) generata con **Capacitor**.

---

## 1. Come Esportare il Progetto dal Web al tuo PC

1. In alto a destra nell'interfaccia di Google AI Studio Build, fai clic sul menu delle impostazioni / esportazione (icona con tre puntini o icona di download).
2. Seleziona **"Export as ZIP"** (oppure fai il push su GitHub).
3. Estrai il file `.zip` in una cartella sul tuo computer (es: `C:\Progetti\MeteoRadar` o `~/MeteoRadar`).

---

## 2. Apertura Rapida in Android Studio

Hai due metodi per aprirlo:

### Metodo A: Direttamente da Android Studio (Consigliato)
1. Apri **Android Studio**.
2. Nella schermata iniziale clicca su **Open** (oppure dal menu **File > Open...**).
3. Seleziona **la cartella `android`** all'interno del progetto estratto (es: `C:\Progetti\MeteoRadar\android`).
4. Attendi che Gradle sincronizzi le dipendenze (l'operazione richiede circa 1 minuto al primo avvio).
5. Premi il tasto verde **Run (▶)** per avviare l'app sull'emulatore Android o sul tuo smartphone collegato via USB!

### Metodo B: Da Riga di Comando (Terminale)
All'interno della cartella principale del progetto:
```bash
# 1. Installa i pacchetti npm
npm install

# 2. Compila e sincronizza
npm run android:sync

# 3. Apri Android Studio in automatico
npm run android:open
```

---

## 3. Come Creare il File APK o Bundle per Google Play

Una volta aperto il progetto in Android Studio:

### Per creare un file APK (Installabile subito su qualsiasi smartphone):
1. Nella barra dei menu in alto di Android Studio vai su:  
   **Build > Build Bundle(s) / APK(s) > Build APK(s)**
2. Al termine comparirà una notifica in basso a destra con il link **"locate"**: cliccaci per trovare il file `app-debug.apk` pronto da trasferire sul tuo smartphone.

### Per creare un file AAB (.aab per Google Play Store):
1. Nella barra dei menu vai su:  
   **Build > Generate Signed Bundle / APK...**
2. Seleziona **Android App Bundle** e segui la procedura guidata per la firma.

---

## 4. Come Modificare il Codice

- **Modifiche UI & Funzionalità React / TypeScript:**
  Modifica i file in `src/` (es: `src/App.tsx`, `src/components/...`).
  Dopo ogni modifica, esegui nel terminale:
  ```bash
  npm run android:sync
  ```
  Le modifiche verranno immediatamente sincronizzate nella cartella Android.

- **Modifiche Native Android (Icone, Splash Screen, Permessi):**
  - **Manifest & Permessi:** `android/app/src/main/AndroidManifest.xml`
  - **Icone App:** `android/app/src/main/res/mipmap-*`
  - **Configurazione App:** `capacitor.config.json` o `android/app/build.gradle`

---

## 5. Dettagli Identificativo e Versione
- **Package ID:** `com.meteoradar.italy`
- **Nome App:** `MeteoRadar 3D & Storm Track`
- **Target SDK:** Android 14 / 15 (API 34/35)
- **Min SDK:** Android 7.0 (API 24+)
