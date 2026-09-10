# 🦋 Guida Completa al Progetto Flutter (MeteoRadar)

Questa cartella (`/flutter_app`) contiene il progetto pronto per essere aperto, modificato e compilato con **Flutter** su qualsiasi PC (Windows, macOS, Linux).

---

## 📁 Struttura del Progetto Flutter

- `flutter_app/`
  - `pubspec.yaml` : File di configurazione e dipendenze Flutter (WebView, Local Notifications, Geolocator, Permissions).
  - `lib/main.dart` : Entrypoint Flutter con gestione WebView ad alte prestazioni, barra di caricamento, gestione permessi (GPS, Notifiche push/locali), tema scuro Material 3 e fallback offline.
  - `assets/web/` : Bundle completo dell'applicazione già sincronizzato per funzionare offline senza dipendere da server esterni.
  - `android/` : Configurazione nativa Android (Manifest, permessi GPS/Vibrazione/Notifiche).

---

## 🚀 1. Come Aprire ed Eseguire il Progetto con Flutter

### Metodo A: Con VS Code o Android Studio
1. Scarica / Esporta l'intero progetto dal menu in alto a destra (**Export as ZIP**).
2. Estrai il file zip sul tuo PC.
3. Apri **VS Code** o **Android Studio** (con il plugin Flutter installato).
4. Seleziona la cartella **`flutter_app`**.
5. Esegui il download delle dipendenze:
   ```bash
   flutter pub get
   ```
6. Collega il tuo smartphone Android/iOS oppure avvia un emulatore e premi **F5** (o il tasto **Run ▶**).

### Metodo B: Da Riga di Comando (Terminale)
```bash
cd flutter_app

# Scarica i pacchetti
flutter pub get

# Avvia l'app in modalità debug sul dispositivo connesso
flutter run
```

---

## 📦 2. Come Generare i Pacchetti di Rilascio (APK e AAB)

All'interno della cartella `flutter_app/`:

### Per creare un file APK (Installabile direttamente su qualsiasi telefono):
```bash
flutter build apk --release
```
*Il file APK generato si troverà in:* `build/app/outputs/flutter-apk/app-release.apk`

### Per creare il bundle per Google Play Store (.aab):
```bash
flutter build appbundle --release
```
*Il file App Bundle si troverà in:* `build/app/outputs/bundle/release/app-release.aab`

---

## 🔄 3. Come Sincronizzare Eventuali Modifiche Web

Se modifichi i componenti React/TypeScript nella cartella principale (`/src`), puoi aggiornare istantaneamente gli asset della cartella Flutter con un solo comando:

```bash
# Dalla cartella radice del progetto:
npm run flutter:sync
```

Questo comando ricompilerà l'app con Vite e aggiornerà automaticamente la cartella `flutter_app/assets/web/`.

---

## ⚠️ Risoluzione Errori Comuni su Windows (Prompt dei Comandi / PowerShell)

### 1. Errore `'-storm-track' non è riconosciuto come comando`
Questo accade quando il percorso della cartella contiene spazi (ad esempio `C:\Meteo Radar 3D & Storm Track`). Su Windows CMD o PowerShell, il carattere `&` o gli spazi non racchiusi tra virgolette dividono il comando a metà:
- **Soluzione**: Rinomina la cartella senza spazi o simboli `&`, ad esempio:
  `C:\Progetti\MeteoRadar` oppure `C:\Progetti\meteoradar_flutter`
- Oppure racchiudi sempre il percorso tra virgolette:
  `cd "C:\Tuo Percorso\Meteo Radar 3D & Storm Track\flutter_app"`

### 2. Errore `ClassNotFoundException: org.gradle.wrapper.GradleWrapperMain`
Questo errore indica che mancavano i file binari del wrapper di Gradle (`gradle-wrapper.jar` e gli script `gradlew` / `gradlew.bat`).
- **Risolto**: Tutti i file del wrapper (`gradle/wrapper/gradle-wrapper.jar`, `gradle-wrapper.properties`, `gradlew` e `gradlew.bat`) sono ora inclusi direttamente nella cartella `flutter_app/android/`.
- Per forzare la rigenerazione pulita da terminale esegui:
  ```bash
  cd flutter_app
  flutter clean
  flutter pub get
  flutter run
  ```

