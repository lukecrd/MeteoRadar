import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:geolocator/geolocator.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin =
    FlutterLocalNotificationsPlugin();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Android & iOS Notifications
  const AndroidInitializationSettings initializationSettingsAndroid =
      AndroidInitializationSettings('@mipmap/ic_launcher');
  const DarwinInitializationSettings initializationSettingsDarwin =
      DarwinInitializationSettings();
  const InitializationSettings initializationSettings = InitializationSettings(
    android: initializationSettingsAndroid,
    iOS: initializationSettingsDarwin,
  );

  await flutterLocalNotificationsPlugin.initialize(
    initializationSettings,
  );

  // Set immersive status bar
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Color(0xFF0F172A),
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );

  runApp(const MeteoRadarApp());
}

class MeteoRadarApp extends StatelessWidget {
  const MeteoRadarApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MeteoRadar 3D & Storm Track',
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.dark,
      theme: ThemeData(
        brightness: Brightness.light,
        colorSchemeSeed: const Color(0xFF0D9488),
        useMaterial3: true,
        fontFamily: 'Roboto',
      ),
      darkTheme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0B1120),
        colorSchemeSeed: const Color(0xFF14B8A6),
        useMaterial3: true,
        fontFamily: 'Roboto',
      ),
      home: const MainRadarScreen(),
    );
  }
}

class MainRadarScreen extends StatefulWidget {
  const MainRadarScreen({super.key});

  @override
  State<MainRadarScreen> createState() => _MainRadarScreenState();
}

class _MainRadarScreenState extends State<MainRadarScreen> {
  late final WebViewController _controller;
  bool _isLoading = true;
  double _loadingProgress = 0.0;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _requestPermissions();
    _initWebView();
  }

  Future<void> _requestPermissions() async {
    try {
      await [
        Permission.location,
        Permission.notification,
      ].request();

      // Check GPS service
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        debugPrint('Location services are disabled.');
      }
    } catch (e) {
      debugPrint('Error requesting permissions: $e');
    }
  }

  void _initWebView() {
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF0B1120))
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (int progress) {
            setState(() {
              _loadingProgress = progress / 100.0;
            });
          },
          onPageStarted: (String url) {
            setState(() {
              _isLoading = true;
              _errorMessage = null;
            });
          },
          onPageFinished: (String url) {
            setState(() {
              _isLoading = false;
            });
          },
          onWebResourceError: (WebResourceError error) {
            debugPrint('WebView error: ${error.description}');
            // If local asset failed, fallback or show reload
            if (_isLoading) {
              setState(() {
                _isLoading = false;
                _errorMessage = error.description;
              });
            }
          },
        ),
      )
      ..addJavaScriptChannel(
        'FlutterBridge',
        onMessageReceived: (JavaScriptMessage message) {
          _handleJavaScriptMessage(message.message);
        },
      );

    _loadAppContent();
  }

  Future<void> _loadAppContent() async {
    try {
      // 1. Try loading from bundled local assets
      await _controller.loadFlutterAsset('assets/web/index.html');
    } catch (e) {
      debugPrint('Local asset not loaded, using fallback: $e');
      // If assets are not yet compiled, load local dev / online preview URL
      await _controller.loadRequest(
        Uri.parse('https://ais-dev-ntormc5ref7p4qhjgc3apj-340420191979.europe-west2.run.app'),
      );
    }
  }

  void _handleJavaScriptMessage(String message) {
    debugPrint('Received message from Web: $message');
    if (message.startsWith('ALERT:')) {
      _showLocalNotification(
        'Allerta Meteo & Temporali',
        message.replaceFirst('ALERT:', '').trim(),
      );
    }
  }

  Future<void> _showLocalNotification(String title, String body) async {
    const AndroidNotificationDetails androidPlatformChannelSpecifics =
        AndroidNotificationDetails(
      'meteoradar_alerts_channel',
      'MeteoRadar Avvisi',
      channelDescription: 'Notifiche e allarmi temporali imminenti',
      importance: Importance.max,
      priority: Priority.high,
      showWhen: true,
      playSound: true,
      enableVibration: true,
    );
    const NotificationDetails platformChannelSpecifics =
        NotificationDetails(android: androidPlatformChannelSpecifics);
    await flutterLocalNotificationsPlugin.show(
      0,
      title,
      body,
      platformChannelSpecifics,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B1120),
      body: SafeArea(
        top: false,
        bottom: false,
        child: Stack(
          children: [
            WebViewWidget(controller: _controller),
            if (_isLoading)
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: LinearProgressIndicator(
                  value: _loadingProgress > 0 ? _loadingProgress : null,
                  backgroundColor: Colors.transparent,
                  valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF14B8A6)),
                  minHeight: 3,
                ),
              ),
            if (_errorMessage != null)
              Center(
                child: Container(
                  margin: const EdgeInsets.all(24),
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.redAccent.withOpacity(0.5)),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.cloud_off, size: 48, color: Colors.redAccent),
                      const SizedBox(height: 12),
                      const Text(
                        'Impossibile caricare i dati radar',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _errorMessage!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 12, color: Colors.white70),
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton.icon(
                        onPressed: () {
                          setState(() {
                            _isLoading = true;
                            _errorMessage = null;
                          });
                          _controller.reload();
                        },
                        icon: const Icon(Icons.refresh),
                        label: const Text('Ricarica Radar'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF0D9488),
                          foregroundColor: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
