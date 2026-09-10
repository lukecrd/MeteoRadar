import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import {
  Layers,
  CloudRain,
  Zap,
  Wind,
  Sun,
  Cloud,
  CloudLightning,
  CloudFog,
  Snowflake,
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  Minimize2,
  MapPin,
  Thermometer,
  Droplets,
  AlertTriangle,
  Info,
  RefreshCw,
  Compass,
  ArrowRight,
  Eye,
  Sliders,
  Radio,
  Gauge,
  Globe,
  Filter,
  Check,
  ChevronDown,
  Navigation,
  Building2,
  ZoomIn,
  ZoomOut,
  Search,
  LocateFixed,
  Grid,
  List
} from 'lucide-react';
import { LocationInfo, ItalyStationWeather, SatelliteLayerType } from '../types';
import {
  fetchRainViewerMaps,
  fetchItalianStationsWeather,
  RainViewerData,
  ITALIAN_CITIES,
  ITALY_REGIONS,
  ItalyRegionInfo
} from '../services/italyMapService';

interface ItalySatelliteMapProps {
  currentLocation: LocationInfo;
  onSelectLocation: (loc: LocationInfo) => void;
  isDark: boolean;
}

export const ItalySatelliteMap: React.FC<ItalySatelliteMapProps> = ({
  currentLocation,
  onSelectLocation,
  isDark
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Layer groups refs
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const radarTileLayerRef = useRef<L.TileLayer | null>(null);
  const satelliteTileLayerRef = useRef<L.TileLayer | null>(null);
  const stationsLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const lightningLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const windVectorLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // State
  const [stations, setStations] = useState<ItalyStationWeather[]>([]);
  const [isLoadingStations, setIsLoadingStations] = useState<boolean>(true);
  const [rainViewerData, setRainViewerData] = useState<RainViewerData | null>(null);
  const [selectedStation, setSelectedStation] = useState<ItalyStationWeather | null>(null);
  const [currentZoomLevel, setCurrentZoomLevel] = useState<number>(6);

  // Region Selection State
  const [selectedRegionId, setSelectedRegionId] = useState<string>('all');
  const [macroAreaFilter, setMacroAreaFilter] = useState<'all' | 'Nord' | 'Centro' | 'Sud' | 'Isole'>('all');
  const [regionsViewMode, setRegionsViewMode] = useState<'scroll' | 'grid'>('scroll');
  
  // Layer toggles & settings
  const [baseMapType, setBaseMapType] = useState<'satellite' | 'dark' | 'streets'>('satellite');
  const [showRadar, setShowRadar] = useState<boolean>(true);
  const [showSatelliteIR, setShowSatelliteIR] = useState<boolean>(true);
  const [showStations, setShowStations] = useState<boolean>(true);
  const [showLightning, setShowLightning] = useState<boolean>(true);
  const [showWindVectors, setShowWindVectors] = useState<boolean>(true);
  
  // Opacity
  const [radarOpacity, setRadarOpacity] = useState<number>(0.75);
  const [satelliteOpacity, setSatelliteOpacity] = useState<number>(0.65);
  
  // Radar timeline & animation
  const [radarFrames, setRadarFrames] = useState<Array<{ time: number; path: string }>>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);
  const [isPlayingRadar, setIsPlayingRadar] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(800); // ms per frame
  const animationTimerRef = useRef<any>(null);

  // Phenomenon filter for stations list
  const [phenomenonFilter, setPhenomenonFilter] = useState<string>('all');
  const [searchRegionQuery, setSearchRegionQuery] = useState<string>('');

  // Simulated real-time lightning strikes for Italy
  const [italyStrikes, setItalyStrikes] = useState<Array<{
    id: string;
    lat: number;
    lon: number;
    ka: number;
    ageMinutes: number;
  }>>([]);

  // Load Italian stations data
  const loadStationsData = async () => {
    setIsLoadingStations(true);
    const data = await fetchItalianStationsWeather();
    setStations(data);
    setIsLoadingStations(false);
  };

  // Generate initial simulated live strikes for Italy
  useEffect(() => {
    const strikes = [
      { id: 'it-1', lat: 45.8, lon: 10.2, ka: 42, ageMinutes: 3 }, // Prealpi lombarde
      { id: 'it-2', lat: 44.1, lon: 9.8, ka: 28, ageMinutes: 7 }, // Appennino Ligure
      { id: 'it-3', lat: 43.6, lon: 12.9, ka: 35, ageMinutes: 12 }, // Marche
      { id: 'it-4', lat: 40.2, lon: 15.6, ka: 50, ageMinutes: 4 }, // Cilento/Campania
      { id: 'it-5', lat: 37.8, lon: 14.9, ka: 31, ageMinutes: 18 }, // Sicilia Est
      { id: 'it-6', lat: 46.2, lon: 12.5, ka: 45, ageMinutes: 9 }, // Dolomiti Friulane
    ];
    setItalyStrikes(strikes);

    // Periodic lightning strike simulation every 15s
    const lightningInterval = setInterval(() => {
      const randomCity = ITALIAN_CITIES[Math.floor(Math.random() * ITALIAN_CITIES.length)];
      const jitterLat = randomCity.lat + (Math.random() - 0.5) * 0.9;
      const jitterLon = randomCity.lon + (Math.random() - 0.5) * 0.9;
      const newStrike = {
        id: `it-${Date.now()}`,
        lat: jitterLat,
        lon: jitterLon,
        ka: Math.round(15 + Math.random() * 65),
        ageMinutes: 0
      };
      setItalyStrikes(prev => [newStrike, ...prev.slice(0, 15).map(s => ({ ...s, ageMinutes: s.ageMinutes + 1 }))]);
    }, 12000);

    return () => clearInterval(lightningInterval);
  }, []);

  // Fetch RainViewer maps info
  useEffect(() => {
    loadStationsData();
    fetchRainViewerMaps().then(data => {
      if (data) {
        setRainViewerData(data);
        const combinedFrames = [...(data.radar.past || []), ...(data.radar.nowcast || [])];
        setRadarFrames(combinedFrames);
        setCurrentFrameIndex(Math.max(0, combinedFrames.length - 1));
      }
    });
  }, []);

  // Initialize Leaflet Map with Deep Zoom support (up to zoom 18 for city/street detail)
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Create Map centered on Italy
    const map = L.map(mapContainerRef.current, {
      center: [42.4, 12.8],
      zoom: 6,
      minZoom: 4,
      maxZoom: 18,
      zoomControl: false,
      attributionControl: false,
      maxBoundsViscosity: 0.2,
    });

    // Zoom listener for responsive UI indicators
    map.on('zoomend', () => {
      setCurrentZoomLevel(Math.round(map.getZoom() * 10) / 10);
    });

    // Set Max bounds around Mediterranean basin and Alpine region
    map.setMaxBounds([
      [32.0, 2.5], // South-West
      [49.5, 21.5]  // North-East
    ]);

    mapInstanceRef.current = map;

    // Create Layer Groups
    stationsLayerGroupRef.current = L.layerGroup().addTo(map);
    lightningLayerGroupRef.current = L.layerGroup().addTo(map);
    windVectorLayerGroupRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle Region Selection and Camera FlyTo
  const handleSelectRegion = (regionId: string) => {
    setSelectedRegionId(regionId);
    const regionInfo = ITALY_REGIONS.find(r => r.id === regionId) || ITALY_REGIONS[0];
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(regionInfo.center, regionInfo.zoom, {
        duration: 1.4,
        easeLinearity: 0.25
      });
    }
  };

  // Zoom preset helper functions
  const zoomToNational = () => {
    handleSelectRegion('all');
  };

  const zoomToRegion = () => {
    const regionInfo = ITALY_REGIONS.find(r => r.id === selectedRegionId) || ITALY_REGIONS[0];
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(regionInfo.center, regionInfo.zoom, { duration: 1.2 });
    }
  };

  const zoomToCityLevel = (lat?: number, lon?: number) => {
    if (!mapInstanceRef.current) return;
    const targetLat = lat ?? (selectedStation?.latitude || 41.9028);
    const targetLon = lon ?? (selectedStation?.longitude || 12.4964);
    mapInstanceRef.current.flyTo([targetLat, targetLon], 14, { duration: 1.4 });
  };

  const zoomInStep = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const zoomOutStep = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  // Update Base Tile Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (baseTileLayerRef.current) {
      map.removeLayer(baseTileLayerRef.current);
    }

    let url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    let maxZoom = 18;
    let maxNativeZoom = 16; // Fix "zoom level not supported" by limiting native tile queries to 16 and letting Leaflet upscale cleanly

    if (baseMapType === 'dark') {
      url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      maxZoom = 18;
      maxNativeZoom = 18;
    } else if (baseMapType === 'streets') {
      url = isDark
        ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      maxZoom = 18;
      maxNativeZoom = 18;
    }

    baseTileLayerRef.current = L.tileLayer(url, {
      maxZoom,
      maxNativeZoom,
      subdomains: 'abcd',
      crossOrigin: true,
    }).addTo(map);

    // Ensure overlays sit above base layer
    if (satelliteTileLayerRef.current) satelliteTileLayerRef.current.bringToFront();
    if (radarTileLayerRef.current) radarTileLayerRef.current.bringToFront();
  }, [baseMapType, isDark]);

  // Update Satellite Infrared Cloud Layer (EUMETSAT / RainViewer IR)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (satelliteTileLayerRef.current) {
      map.removeLayer(satelliteTileLayerRef.current);
      satelliteTileLayerRef.current = null;
    }

    if (showSatelliteIR && rainViewerData && rainViewerData.satellite.infrared.length > 0) {
      const latestSat = rainViewerData.satellite.infrared[rainViewerData.satellite.infrared.length - 1];
      const satUrl = `${rainViewerData.host}${latestSat.path}/256/{z}/{x}/{y}/0/0_0.png`;

      satelliteTileLayerRef.current = L.tileLayer(satUrl, {
        opacity: satelliteOpacity,
        zIndex: 5,
        maxNativeZoom: 6, // RainViewer Infrared Satellite maximum native zoom is 6
        maxZoom: 18,
        crossOrigin: true,
      }).addTo(map);
    }
  }, [showSatelliteIR, rainViewerData, satelliteOpacity]);

  // Update Radar Layer with current Frame
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (radarTileLayerRef.current) {
      map.removeLayer(radarTileLayerRef.current);
      radarTileLayerRef.current = null;
    }

    if (showRadar && rainViewerData && radarFrames.length > 0 && radarFrames[currentFrameIndex]) {
      const frame = radarFrames[currentFrameIndex];
      // 2/1_1.png = Color scheme with smoothing and dBZ thresholds
      const radarUrl = `${rainViewerData.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;

      radarTileLayerRef.current = L.tileLayer(radarUrl, {
        opacity: radarOpacity,
        zIndex: 10,
        maxNativeZoom: 7, // RainViewer Weather Radar API maximum native zoom is 7
        maxZoom: 18,
        crossOrigin: true,
      }).addTo(map);
    }
  }, [showRadar, rainViewerData, radarFrames, currentFrameIndex, radarOpacity]);

  // Radar Animation Loop
  useEffect(() => {
    if (isPlayingRadar && radarFrames.length > 1) {
      animationTimerRef.current = setInterval(() => {
        setCurrentFrameIndex(prev => (prev + 1) % radarFrames.length);
      }, playbackSpeed);
    } else {
      if (animationTimerRef.current) clearInterval(animationTimerRef.current);
    }

    return () => {
      if (animationTimerRef.current) clearInterval(animationTimerRef.current);
    };
  }, [isPlayingRadar, radarFrames.length, playbackSpeed]);

  // Filter stations to display on map based on Selected Region
  const mapVisibleStations = useMemo(() => {
    if (selectedRegionId === 'all') {
      return stations;
    }
    return stations.filter(st => st.region.toLowerCase() === selectedRegionId.toLowerCase());
  }, [stations, selectedRegionId]);

  // Render Italian Station Markers
  useEffect(() => {
    const lg = stationsLayerGroupRef.current;
    if (!lg) return;
    lg.clearLayers();

    if (!showStations) return;

    mapVisibleStations.forEach(st => {
      const alertBorder = st.alertLevel === 'red'
        ? 'ring-2 ring-rose-500 animate-pulse'
        : st.alertLevel === 'orange'
        ? 'ring-2 ring-amber-500'
        : st.alertLevel === 'yellow'
        ? 'ring-1 ring-yellow-400'
        : 'border-slate-700/80';

      const isCurrentActive = currentLocation.name.toLowerCase().includes(st.name.toLowerCase());
      const isSelectedInRegion = selectedRegionId !== 'all';

      const customIcon = L.divIcon({
        className: 'custom-station-pin',
        html: `
          <div class="relative group cursor-pointer transform -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-110">
            <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full shadow-xl backdrop-blur-md ${
              isCurrentActive
                ? 'bg-teal-500 text-white ring-2 ring-white font-extrabold'
                : isSelectedInRegion
                ? 'bg-slate-900/95 text-white border-2 border-teal-400 shadow-teal-500/20'
                : 'bg-slate-900/90 text-white border border-slate-700'
            } ${alertBorder}">
              <span class="w-2 h-2 rounded-full ${
                st.phenomenon === 'storm'
                  ? 'bg-purple-400 animate-ping'
                  : st.phenomenon === 'rain'
                  ? 'bg-sky-400'
                  : st.phenomenon === 'snow'
                  ? 'bg-cyan-300'
                  : st.phenomenon === 'fog'
                  ? 'bg-teal-300'
                  : 'bg-amber-400'
              }"></span>
              <span class="text-[11px] font-bold tracking-tight">${st.name}</span>
              <span class="text-[11px] font-black text-amber-300">${st.temperature}°</span>
            </div>
          </div>
        `,
        iconSize: [85, 30],
        iconAnchor: [42, 15],
      });

      const marker = L.marker([st.latitude, st.longitude], { icon: customIcon });
      
      marker.on('click', () => {
        setSelectedStation(st);
      });

      marker.addTo(lg);
    });
  }, [mapVisibleStations, showStations, currentLocation, selectedRegionId]);

  // Render Lightning Flash Shockwave Markers
  useEffect(() => {
    const lg = lightningLayerGroupRef.current;
    if (!lg) return;
    lg.clearLayers();

    if (!showLightning) return;

    italyStrikes.forEach(s => {
      const strikeIcon = L.divIcon({
        className: 'custom-lightning-flash',
        html: `
          <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
            <span class="absolute w-8 h-8 rounded-full bg-purple-500/30 animate-ping"></span>
            <span class="absolute w-5 h-5 rounded-full bg-amber-400/40"></span>
            <div class="w-3.5 h-3.5 rounded-full bg-amber-300 border-2 border-purple-600 shadow-lg flex items-center justify-center text-[8px] font-black text-slate-950">
              ⚡
            </div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const strikeMarker = L.marker([s.lat, s.lon], { icon: strikeIcon });
      strikeMarker.bindTooltip(`Fulmine rilevato: ${s.ka} kA (${s.ageMinutes} min fa)`, {
        direction: 'top',
        className: 'bg-slate-900 text-white text-xs border border-purple-500 rounded-lg p-1.5'
      });
      strikeMarker.addTo(lg);
    });
  }, [italyStrikes, showLightning]);

  // Render Wind Streamlines Vectors across Italian Seas
  useEffect(() => {
    const lg = windVectorLayerGroupRef.current;
    if (!lg) return;
    lg.clearLayers();

    if (!showWindVectors) return;

    // Strategic maritime & mountain anemometer vector points around Italy
    const maritimeWindPoints = [
      { name: 'Mar Ligure', lat: 43.8, lon: 8.8, speed: 24, deg: 230, label: 'Libeccio' },
      { name: 'Tirreno Settentrionale', lat: 42.0, lon: 10.5, speed: 18, deg: 210, label: 'Ponente' },
      { name: 'Tirreno Meridionale', lat: 39.5, lon: 13.5, speed: 16, deg: 170, label: 'Ostro' },
      { name: 'Canale di Sicilia', lat: 36.8, lon: 12.8, speed: 28, deg: 140, label: 'Scirocco' },
      { name: 'Mar Ionio', lat: 38.5, lon: 17.5, speed: 20, deg: 130, label: 'Levante' },
      { name: 'Basso Adriatico', lat: 41.5, lon: 17.8, speed: 22, deg: 310, label: 'Maestrale' },
      { name: 'Medio Adriatico', lat: 43.2, lon: 14.8, speed: 19, deg: 320, label: 'Maestrale' },
      { name: 'Alto Adriatico (Golfo TS)', lat: 45.3, lon: 13.2, speed: 34, deg: 45, label: 'Bora' },
      { name: 'Bocche di Bonifacio', lat: 41.3, lon: 9.2, speed: 38, deg: 280, label: 'Ponente Forte' },
      { name: 'Arco Alpino Nord-Ovest', lat: 45.8, lon: 7.8, speed: 25, deg: 340, label: 'Favonio / Föhn' }
    ];

    maritimeWindPoints.forEach(p => {
      const windIcon = L.divIcon({
        className: 'custom-wind-barb',
        html: `
          <div class="flex items-center gap-1 bg-slate-900/80 backdrop-blur-sm border border-slate-700/80 px-2 py-0.5 rounded-full text-white -translate-x-1/2 -translate-y-1/2 shadow-md">
            <div style="transform: rotate(${p.deg}deg);" class="transition-transform duration-500">
              <svg class="w-3 h-3 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"></line>
                <polyline points="5 12 12 5 19 12"></polyline>
              </svg>
            </div>
            <span class="text-[10px] font-extrabold text-cyan-300">${p.speed} <span class="text-[8px] font-normal text-slate-400">km/h</span></span>
          </div>
        `,
        iconSize: [60, 20],
        iconAnchor: [30, 10]
      });

      const marker = L.marker([p.lat, p.lon], { icon: windIcon });
      marker.bindTooltip(`${p.name}: ${p.label} a ${p.speed} km/h (${p.deg}°)`, {
        direction: 'top',
        className: 'bg-slate-900 text-white text-xs border border-cyan-500 rounded-lg p-1.5'
      });
      marker.addTo(lg);
    });
  }, [showWindVectors]);

  // Handle station selection to set as active location in the whole app
  const handleSetLocationFromStation = (st: ItalyStationWeather) => {
    onSelectLocation({
      name: st.name,
      country: 'Italia',
      latitude: st.latitude,
      longitude: st.longitude,
      admin1: st.region
    });
    // Pan map to chosen station with close city-level zoom (14x)
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([st.latitude, st.longitude], 14, { duration: 1.3 });
    }
  };

  // Selected Region Metadata
  const currentRegionInfo = useMemo(() => {
    return ITALY_REGIONS.find(r => r.id === selectedRegionId) || ITALY_REGIONS[0];
  }, [selectedRegionId]);

  // Regional Filtered Stations for the explorer grid
  const filteredStations = useMemo(() => {
    return stations.filter(st => {
      // Filter by selected region
      if (selectedRegionId !== 'all' && st.region.toLowerCase() !== selectedRegionId.toLowerCase()) {
        return false;
      }
      // Filter by macro-area if in national view
      if (selectedRegionId === 'all' && macroAreaFilter !== 'all') {
        const regInfo = ITALY_REGIONS.find(r => r.name.toLowerCase() === st.region.toLowerCase());
        if (regInfo && regInfo.macroArea !== macroAreaFilter) {
          return false;
        }
      }
      // Search query filter
      const matchSearch = st.name.toLowerCase().includes(searchRegionQuery.toLowerCase()) ||
                          st.region.toLowerCase().includes(searchRegionQuery.toLowerCase());
      if (!matchSearch) return false;
      // Phenomenon filter
      if (phenomenonFilter === 'all') return true;
      if (phenomenonFilter === 'rain') return st.phenomenon === 'rain' || st.phenomenon === 'storm';
      if (phenomenonFilter === 'storm') return st.phenomenon === 'storm';
      if (phenomenonFilter === 'wind') return st.windSpeed >= 25;
      if (phenomenonFilter === 'fog') return st.phenomenon === 'fog';
      if (phenomenonFilter === 'snow') return st.phenomenon === 'snow';
      return true;
    });
  }, [stations, selectedRegionId, macroAreaFilter, searchRegionQuery, phenomenonFilter]);

  // Current radar frame timestamp format
  const currentFrameTimestamp = useMemo(() => {
    if (radarFrames.length === 0 || !radarFrames[currentFrameIndex]) return 'Tempo Reale';
    const timestamp = radarFrames[currentFrameIndex].time * 1000;
    const date = new Date(timestamp);
    return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) + ' CEST';
  }, [radarFrames, currentFrameIndex]);

  // Dynamic Statistics (National or Region-Specific)
  const dynamicStats = useMemo(() => {
    const targetPool = selectedRegionId === 'all' 
      ? stations 
      : stations.filter(s => s.region.toLowerCase() === selectedRegionId.toLowerCase());

    if (targetPool.length === 0) {
      return { 
        maxTemp: '--', 
        minTemp: '--', 
        avgTemp: '--', 
        avgHumidity: '--', 
        maxWind: '--', 
        rainCount: 0,
        totalStations: 0
      };
    }

    const sortedByTemp = [...targetPool].sort((a, b) => b.temperature - a.temperature);
    const maxT = sortedByTemp[0];
    const minT = sortedByTemp[sortedByTemp.length - 1];
    const avgT = Math.round(targetPool.reduce((acc, s) => acc + s.temperature, 0) / targetPool.length);
    const avgH = Math.round(targetPool.reduce((acc, s) => acc + s.humidity, 0) / targetPool.length);
    const maxW = [...targetPool].sort((a, b) => b.windSpeed - a.windSpeed)[0];
    const rainCount = targetPool.filter(s => s.phenomenon === 'rain' || s.phenomenon === 'storm').length;

    return {
      maxTemp: `${maxT.temperature}° (${maxT.name})`,
      minTemp: `${minT.temperature}° (${minT.name})`,
      avgTemp: `${avgT}°C`,
      avgHumidity: `${avgH}%`,
      maxWind: `${maxW.windSpeed} km/h (${maxW.name})`,
      rainCount,
      totalStations: targetPool.length
    };
  }, [stations, selectedRegionId]);

  // Available regions for the selector dropdown/list
  const regionOptions = useMemo(() => {
    return ITALY_REGIONS;
  }, []);

  return (
    <div className="space-y-6 w-full max-w-full overflow-hidden animate-in fade-in duration-300">
      {/* Region Selector Bar with Macro-Area Pills */}
      <div
        className={`p-4 rounded-3xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all w-full max-w-full overflow-hidden ${
          isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Left: Region Picker Dropdown */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 shrink-0">
              <Building2 className="w-4 h-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Regione Monitorata
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <select
                  id="select-italy-region"
                  value={selectedRegionId}
                  onChange={(e) => handleSelectRegion(e.target.value)}
                  className={`text-xs sm:text-sm font-black rounded-xl px-3 py-1.5 border transition-colors cursor-pointer outline-none max-w-full truncate ${
                    selectedRegionId !== 'all'
                      ? 'bg-teal-500/15 border-teal-500/40 text-teal-400'
                      : isDark
                      ? 'bg-slate-800 border-slate-700 text-slate-100'
                      : 'bg-slate-100 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="all">🇮🇹 Tutte le 20 Regioni (Nazionale)</option>
                  <optgroup label="Nord Italia">
                    {ITALY_REGIONS.filter(r => r.macroArea === 'Nord').map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Centro Italia">
                    {ITALY_REGIONS.filter(r => r.macroArea === 'Centro').map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Sud Italia">
                    {ITALY_REGIONS.filter(r => r.macroArea === 'Sud').map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Isole Maggiori">
                    {ITALY_REGIONS.filter(r => r.macroArea === 'Isole').map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </optgroup>
                </select>

                {selectedRegionId !== 'all' && (
                  <button
                    type="button"
                    id="btn-reset-to-national-view"
                    onClick={() => handleSelectRegion('all')}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors shrink-0"
                    title="Torna alla vista panoramica di tutta l'Italia"
                  >
                    Tutta Italia
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Macro-Area Quick Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 max-w-full">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3 text-teal-400" /> Area:
          </span>
          {[
            { id: 'all', label: 'Tutte' },
            { id: 'Nord', label: 'Nord' },
            { id: 'Centro', label: 'Centro' },
            { id: 'Sud', label: 'Sud' },
            { id: 'Isole', label: 'Isole' },
          ].map((macro) => (
            <button
              key={macro.id}
              type="button"
              id={`macro-area-filter-${macro.id}`}
              onClick={() => {
                setMacroAreaFilter(macro.id as any);
                if (macro.id !== 'all' && selectedRegionId !== 'all') {
                  const curr = ITALY_REGIONS.find(r => r.id === selectedRegionId);
                  if (curr && curr.macroArea !== macro.id) {
                    handleSelectRegion('all');
                  }
                }
              }}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-colors shrink-0 ${
                macroAreaFilter === macro.id
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {macro.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top Banner with Real-time Italy Satellite Headline & Metrics */}
      <div
        className={`p-5 rounded-3xl border relative overflow-hidden transition-all ${
          isDark
            ? 'bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-800 border-slate-800 text-slate-100'
            : 'bg-gradient-to-r from-white via-slate-50 to-teal-50/40 border-slate-200 text-slate-900 shadow-sm'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-500/20 text-teal-400 text-xs font-black border border-teal-500/30 uppercase tracking-wider">
                <Radio className="w-3.5 h-3.5 animate-pulse text-teal-400" />
                {selectedRegionId === 'all' ? 'Mappa Satellitare Live Italia' : `Monitoraggio Regionale: ${currentRegionInfo.name}`}
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                EUMETSAT Meteosat & Radar Doppler
              </span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {selectedRegionId === 'all' 
                ? 'Quadro Sinottico & Fenomeni Atmosferici Italia'
                : `Analisi Satellitare e Stazioni: ${currentRegionInfo.name}`}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl">
              {selectedRegionId === 'all'
                ? 'Visualizzazione in tempo reale di nubi all\'infrarosso (IR), riflettività radar delle precipitazioni (dBZ), campo anemologico dei venti e scariche di fulmini sul bacino italiano.'
                : `${currentRegionInfo.description}. Dati in tempo reale da ${dynamicStats.totalStations} stazioni provinciali, radar precipitazioni e dinamica del vento.`}
            </p>
          </div>

          {/* Key Regional/National Telemetry Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
            <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-800/60 border-slate-700/60' : 'bg-white border-slate-200'}`}>
              <div className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                <Thermometer className="w-3 h-3 text-amber-500" /> Temp Max
              </div>
              <div className="text-xs font-black text-amber-500 dark:text-amber-400 mt-0.5 truncate">{dynamicStats.maxTemp}</div>
            </div>

            <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-800/60 border-slate-700/60' : 'bg-white border-slate-200'}`}>
              <div className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                <Thermometer className="w-3 h-3 text-cyan-400" /> Temp Min
              </div>
              <div className="text-xs font-black text-cyan-400 dark:text-cyan-300 mt-0.5 truncate">{dynamicStats.minTemp}</div>
            </div>

            <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-800/60 border-slate-700/60' : 'bg-white border-slate-200'}`}>
              <div className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                <Wind className="w-3 h-3 text-teal-400" /> Vento Max
              </div>
              <div className="text-xs font-black text-teal-400 dark:text-teal-300 mt-0.5 truncate">{dynamicStats.maxWind}</div>
            </div>

            <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-800/60 border-slate-700/60' : 'bg-white border-slate-200'}`}>
              <div className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                <CloudRain className="w-3 h-3 text-sky-400" /> {selectedRegionId === 'all' ? 'Pioggia Nazionale' : 'Pioggia Regione'}
              </div>
              <div className="text-xs font-black text-sky-400 dark:text-sky-300 mt-0.5">{dynamicStats.rainCount} / {dynamicStats.totalStations} staz.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Map Visualizer Box */}
      <div
        className={`rounded-3xl border overflow-hidden shadow-2xl relative transition-all ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        {/* Top Floating Control Bar */}
        <div
          className={`p-3.5 border-b flex flex-wrap items-center justify-between gap-3 backdrop-blur-md z-20 relative ${
            isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50/90 border-slate-200'
          }`}
        >
          {/* Layer Base Switcher */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 mr-1 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-teal-400" /> Sfondo:
            </span>
            <button
              id="btn-basemap-satellite"
              onClick={() => setBaseMapType('satellite')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                baseMapType === 'satellite'
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              🛰️ Satellite HD
            </button>
            <button
              id="btn-basemap-dark"
              onClick={() => setBaseMapType('dark')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                baseMapType === 'dark'
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              🌑 Radar Dark
            </button>
            <button
              id="btn-basemap-streets"
              onClick={() => setBaseMapType('streets')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                baseMapType === 'streets'
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              🗺️ Geografica
            </button>
          </div>

          {/* Overlays Toggle Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              id="toggle-satellite-ir-layer"
              onClick={() => setShowSatelliteIR(!showSatelliteIR)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                showSatelliteIR
                  ? 'bg-indigo-600/20 text-indigo-400 dark:text-indigo-300 border-indigo-500/40'
                  : 'bg-transparent text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-200 dark:hover:bg-slate-800/60'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Nubi IR Satellite</span>
            </button>

            <button
              id="toggle-radar-rain-layer"
              onClick={() => setShowRadar(!showRadar)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                showRadar
                  ? 'bg-sky-500/20 text-sky-400 dark:text-sky-300 border-sky-500/40'
                  : 'bg-transparent text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-200 dark:hover:bg-slate-800/60'
              }`}
            >
              <CloudRain className="w-3.5 h-3.5" />
              <span>Radar Pioggia</span>
            </button>

            <button
              id="toggle-lightning-layer"
              onClick={() => setShowLightning(!showLightning)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                showLightning
                  ? 'bg-purple-500/20 text-purple-400 dark:text-purple-300 border-purple-500/40'
                  : 'bg-transparent text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-200 dark:hover:bg-slate-800/60'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Fulmini Live ({italyStrikes.length})</span>
            </button>

            <button
              id="toggle-wind-vectors-layer"
              onClick={() => setShowWindVectors(!showWindVectors)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                showWindVectors
                  ? 'bg-cyan-500/20 text-cyan-400 dark:text-cyan-300 border-cyan-500/40'
                  : 'bg-transparent text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-200 dark:hover:bg-slate-800/60'
              }`}
            >
              <Wind className="w-3.5 h-3.5" />
              <span>Vento Mari</span>
            </button>

            <button
              id="toggle-stations-layer"
              onClick={() => setShowStations(!showStations)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                showStations
                  ? 'bg-teal-500/20 text-teal-400 dark:text-teal-300 border-teal-500/40'
                  : 'bg-transparent text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-200 dark:hover:bg-slate-800/60'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Stazioni ({mapVisibleStations.length})</span>
            </button>
          </div>
        </div>

        {/* Leaflet Map Interactive Canvas */}
        <div className="relative w-full h-[520px] sm:h-[580px] bg-slate-950">
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* Dedicated Deep Zoom & Preset Controls Bar (Top Right) */}
          <div className="absolute top-4 right-4 z-30 flex flex-col items-end gap-2">
            {/* Zoom Stepper Buttons */}
            <div
              className={`p-1.5 rounded-2xl border shadow-2xl backdrop-blur-xl flex flex-col items-center gap-1 ${
                isDark ? 'bg-slate-900/90 border-slate-700/80 text-slate-100' : 'bg-white/90 border-slate-300 text-slate-900'
              }`}
            >
              <button
                type="button"
                id="btn-map-zoom-in"
                onClick={zoomInStep}
                className="p-2 rounded-xl hover:bg-teal-500/20 text-teal-400 hover:text-teal-300 transition-colors"
                title="Ingrandisci mappa (fino a livello quartiere/città)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <div className="h-px w-5 bg-slate-700/50" />

              <button
                type="button"
                id="btn-map-zoom-out"
                onClick={zoomOutStep}
                className="p-2 rounded-xl hover:bg-teal-500/20 text-teal-400 hover:text-teal-300 transition-colors"
                title="Riduci ingrandimento"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Level Preset Pills (Nazionale, Regione, Città) */}
            <div
              className={`p-1.5 rounded-2xl border shadow-2xl backdrop-blur-xl flex flex-col gap-1 text-[11px] font-black ${
                isDark ? 'bg-slate-900/90 border-slate-700/80 text-slate-200' : 'bg-white/90 border-slate-300 text-slate-800'
              }`}
            >
              <div className="px-2 py-0.5 text-[9px] uppercase tracking-wider text-slate-600 dark:text-slate-300 font-bold text-center">
                Zoom Rapido
              </div>
              <button
                type="button"
                id="btn-zoom-preset-national"
                onClick={zoomToNational}
                className={`px-2.5 py-1 rounded-xl text-left transition-colors flex items-center gap-1.5 ${
                  currentZoomLevel <= 7
                    ? 'bg-teal-500 text-white shadow-sm'
                    : 'hover:bg-slate-800 text-slate-300'
                }`}
                title="Vista complessiva su tutta l'Italia"
              >
                <span>🇮🇹</span>
                <span>Italia</span>
              </button>

              <button
                type="button"
                id="btn-zoom-preset-region"
                onClick={zoomToRegion}
                className={`px-2.5 py-1 rounded-xl text-left transition-colors flex items-center gap-1.5 ${
                  currentZoomLevel > 7 && currentZoomLevel < 12
                    ? 'bg-teal-500 text-white shadow-sm'
                    : 'hover:bg-slate-800 text-slate-300'
                }`}
                title="Zoom centrato sulla regione selezionata"
              >
                <span>📍</span>
                <span>Regione</span>
              </button>

              <button
                type="button"
                id="btn-zoom-preset-city"
                onClick={() => zoomToCityLevel()}
                className={`px-2.5 py-1 rounded-xl text-left transition-colors flex items-center gap-1.5 ${
                  currentZoomLevel >= 12
                    ? 'bg-teal-500 text-white shadow-sm'
                    : 'hover:bg-slate-800 text-slate-300'
                }`}
                title="Zoom ravvicinato ad alta risoluzione (livello città e strade)"
              >
                <span>🏙️</span>
                <span>Città HD</span>
              </button>

              {/* Current Zoom badge */}
              <div className="text-[9px] font-bold text-center text-slate-600 dark:text-slate-300 pt-0.5 border-t border-slate-700/50">
                {currentZoomLevel >= 14 ? '🔍 Città' : currentZoomLevel >= 9 ? '📍 Regione' : '🇮🇹 Italia'} ({currentZoomLevel}x)
              </div>
            </div>
          </div>

          {/* Region Badge overlay at top-left inside map */}
          {selectedRegionId !== 'all' && (
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-950/85 border border-teal-500/40 text-teal-400 backdrop-blur-md shadow-xl text-xs font-black animate-in fade-in">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              <span>Vista Regionale: {currentRegionInfo.name}</span>
              <button
                type="button"
                onClick={() => handleSelectRegion('all')}
                className="ml-1.5 text-slate-400 hover:text-white text-[10px] font-bold underline"
              >
                Reset Italia
              </button>
            </div>
          )}

          {/* Selected Station Floating Drawer (if opened) */}
          {selectedStation && (
            <div
              className={`absolute top-4 left-4 z-30 max-w-sm w-80 rounded-2xl border shadow-2xl p-4 backdrop-blur-xl animate-in slide-in-from-left-5 duration-200 ${
                isDark ? 'bg-slate-900/95 border-slate-700 text-slate-100' : 'bg-white/95 border-slate-200 text-slate-900'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-extrabold text-base">{selectedStation.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                      {selectedStation.region}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedStation.weatherDescription}</p>
                </div>
                <button
                  onClick={() => setSelectedStation(null)}
                  className="text-slate-400 hover:text-white text-sm font-bold p-1"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <div className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Temp</div>
                  <div className="text-base font-black text-amber-400">{selectedStation.temperature}°C</div>
                </div>
                <div className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Umidità</div>
                  <div className="text-base font-black text-cyan-400">{selectedStation.humidity}%</div>
                </div>
                <div className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Vento</div>
                  <div className="text-base font-black text-teal-400">{selectedStation.windSpeed}k</div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                <span>Pressione: <strong className="text-slate-200">{selectedStation.pressure} hPa</strong></span>
                <span>Precipitazioni: <strong className="text-sky-400">{selectedStation.precipitation} mm</strong></span>
              </div>

              {/* Quick Zoom Actions inside station drawer */}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => zoomToCityLevel(selectedStation.latitude, selectedStation.longitude)}
                  className="py-1.5 px-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 font-bold text-xs flex items-center justify-center gap-1 border border-teal-500/30 transition-colors"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span>Zoom Città HD</span>
                </button>
                <button
                  type="button"
                  onClick={zoomToRegion}
                  className="py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1 border border-slate-700 transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Vista Regione</span>
                </button>
              </div>

              <button
                id="btn-select-station-as-current"
                onClick={() => handleSetLocationFromStation(selectedStation)}
                className="w-full mt-2.5 py-2 px-3 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-teal-500/25 transition-all"
              >
                <span>Imposta come Stazione Principale</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Interactive Legend Box (Bottom Left of Map) */}
          <div
            className={`absolute bottom-4 left-4 z-20 p-3 rounded-2xl border shadow-xl backdrop-blur-md hidden sm:block ${
              isDark ? 'bg-slate-950/85 border-slate-800 text-slate-200' : 'bg-white/90 border-slate-200 text-slate-800'
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
              <Info className="w-3 h-3 text-teal-400" /> Scala Riflettività Radar (dBZ)
            </div>
            <div className="flex items-center gap-1 text-[9px] font-bold">
              <span className="text-slate-400">Debole</span>
              <div className="w-24 h-2.5 rounded-full bg-gradient-to-r from-teal-400 via-sky-400 via-amber-400 via-rose-500 to-purple-600 border border-slate-700/60" />
              <span className="text-purple-400">Nubifragio/Grandine</span>
            </div>
          </div>

          {/* Layer Opacity Sliders Popover */}
          <div
            className={`absolute bottom-4 right-4 z-20 p-2.5 rounded-2xl border shadow-xl backdrop-blur-md hidden md:flex items-center gap-3 ${
              isDark ? 'bg-slate-950/85 border-slate-800 text-slate-200' : 'bg-white/90 border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[10px] font-bold text-slate-400">Opacità Radar:</span>
              <input
                type="range"
                min="0.2"
                max="1.0"
                step="0.05"
                value={radarOpacity}
                onChange={(e) => setRadarOpacity(parseFloat(e.target.value))}
                className="w-16 h-1.5 accent-sky-400 cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[10px] font-bold text-slate-400">Opacità Nubi:</span>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={satelliteOpacity}
                onChange={(e) => setSatelliteOpacity(parseFloat(e.target.value))}
                className="w-16 h-1.5 accent-indigo-400 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Radar Playback Loop Bar */}
        <div
          className={`p-3 border-t flex flex-col sm:flex-row items-center justify-between gap-3 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <button
              id="radar-play-pause-btn"
              onClick={() => setIsPlayingRadar(!isPlayingRadar)}
              className="p-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white shadow-md transition-colors flex items-center gap-1 text-xs font-bold"
            >
              {isPlayingRadar ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
              <span>{isPlayingRadar ? 'Pausa' : 'Loop Radar'}</span>
            </button>

            <button
              id="radar-reset-btn"
              onClick={() => {
                setIsPlayingRadar(false);
                if (radarFrames.length > 0) setCurrentFrameIndex(radarFrames.length - 1);
              }}
              className="p-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              title="Torna all'ultimo frame live"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <div className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span>Orario Radar:</span>
              <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-teal-400 font-black">
                {currentFrameTimestamp}
              </span>
            </div>
          </div>

          {/* Frame Slider */}
          {radarFrames.length > 0 && (
            <div className="flex-1 max-w-md flex items-center gap-2 w-full">
              <span className="text-[10px] text-slate-400 font-semibold">-1h30</span>
              <input
                id="radar-frame-slider"
                type="range"
                min="0"
                max={radarFrames.length - 1}
                value={currentFrameIndex}
                onChange={(e) => {
                  setIsPlayingRadar(false);
                  setCurrentFrameIndex(parseInt(e.target.value, 10));
                }}
                className="w-full h-2 accent-teal-500 cursor-pointer bg-slate-300 dark:bg-slate-700 rounded-lg"
              />
              <span className="text-[10px] text-teal-400 font-bold">Live</span>
            </div>
          )}
        </div>
      </div>

      {/* Regional Stations & Phenomena Explorer Grid */}
      <div
        className={`p-4 sm:p-6 rounded-3xl border shadow-lg space-y-4 w-full max-w-full overflow-hidden ${
          isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-lg tracking-tight flex items-center gap-2 text-slate-900 dark:text-white">
              <span>{selectedRegionId === 'all' ? "Rete Osservativa d'Italia" : `Stazioni Meteo: ${currentRegionInfo.name}`}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                {filteredStations.length} stazioni
              </span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {selectedRegionId === 'all'
                ? "Clicca su qualsiasi città per effettuare lo zoom ravvicinato (14x) a livello strada/radar o impostarla come stazione."
                : `Monitoraggio provinciale per la regione ${currentRegionInfo.name}. Clicca su una città per zoomare direttamente.`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadStationsData}
              disabled={isLoadingStations}
              className="p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStations ? 'animate-spin text-teal-400' : ''}`} />
              <span>Aggiorna Dati</span>
            </button>
          </div>
        </div>

        {/* 20 Regions Quick Selection Bar (with scroll and grid toggle) */}
        <div className="space-y-2 pt-1 pb-1 w-full max-w-full overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">
            <span>Seleziona Regione specifica (20 Regioni Italiane):</span>
            <div className="flex items-center gap-2">
              {selectedRegionId !== 'all' && (
                <button
                  type="button"
                  onClick={() => handleSelectRegion('all')}
                  className="text-teal-400 hover:underline font-bold text-[11px]"
                >
                  Mostra tutte le 20 regioni
                </button>
              )}
              <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-lg border border-slate-700">
                <button
                  type="button"
                  onClick={() => setRegionsViewMode('scroll')}
                  className={`p-1 rounded text-xs transition-colors ${regionsViewMode === 'scroll' ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                  title="Vista a scorrimento orizzontale"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setRegionsViewMode('grid')}
                  className={`p-1 rounded text-xs transition-colors ${regionsViewMode === 'grid' ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                  title="Vista a griglia completa"
                >
                  <Grid className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {regionsViewMode === 'scroll' ? (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin w-full max-w-full">
              <button
                type="button"
                id="pill-region-all"
                onClick={() => handleSelectRegion('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all shrink-0 ${
                  selectedRegionId === 'all'
                    ? 'bg-teal-500 text-white shadow-md shadow-teal-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                🇮🇹 Tutte le 20 Regioni
              </button>
              {ITALY_REGIONS.filter(r => r.id !== 'all').map((r) => (
                <button
                  key={r.id}
                  type="button"
                  id={`pill-region-${r.id.toLowerCase().replace(/[^a-z0-9]/g, '')}`}
                  onClick={() => handleSelectRegion(r.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                    selectedRegionId === r.id
                      ? 'bg-teal-500 text-white shadow-md shadow-teal-500/20 ring-1 ring-teal-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {r.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 pt-1 w-full max-w-full">
              <button
                type="button"
                onClick={() => handleSelectRegion('all')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-extrabold truncate transition-all text-left ${
                  selectedRegionId === 'all'
                    ? 'bg-teal-500 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                🇮🇹 Tutte le Regioni
              </button>
              {ITALY_REGIONS.filter(r => r.id !== 'all').map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleSelectRegion(r.id)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold truncate transition-all text-left ${
                    selectedRegionId === r.id
                      ? 'bg-teal-500 text-white shadow-sm ring-1 ring-teal-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {r.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Phenomenon & Search Filters Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pb-1 w-full max-w-full">
          {/* Phenomenon Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 mr-1">Filtro meteo:</span>
            {[
              { id: 'all', label: 'Tutti' },
              { id: 'rain', label: '🌧️ Pioggia' },
              { id: 'storm', label: '⚡ Temporali' },
              { id: 'wind', label: '💨 Vento >25k' },
              { id: 'fog', label: '🌫️ Nebbia' },
              { id: 'snow', label: '❄️ Neve' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setPhenomenonFilter(f.id)}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                  phenomenonFilter === f.id
                    ? 'bg-teal-500 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search input */}
          <div className="relative w-full md:w-56 shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cerca città o regione..."
              value={searchRegionQuery}
              onChange={(e) => setSearchRegionQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-teal-500"
            />
          </div>
        </div>

        {/* Stations Table Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 w-full max-w-full">
          {filteredStations.map(st => {
            const isCurrentActive = currentLocation.name.toLowerCase().includes(st.name.toLowerCase());

            return (
              <div
                key={st.id}
                onClick={() => {
                  setSelectedStation(st);
                  if (mapInstanceRef.current) {
                    // Deep zoom directly to city level
                    mapInstanceRef.current.flyTo([st.latitude, st.longitude], 14, { duration: 1.3 });
                  }
                }}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer group ${
                  isCurrentActive
                    ? 'border-teal-500 bg-teal-500/10 ring-1 ring-teal-500'
                    : isDark
                    ? 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/80 hover:border-slate-600'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-teal-400 transition-colors">
                      {st.name}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-300 font-semibold">({st.region})</span>
                  </div>
                  <span className="text-base font-black text-amber-500 dark:text-amber-400">+{st.temperature}°C</span>
                </div>

                <div className="text-xs text-slate-700 dark:text-slate-200 mt-1 truncate font-medium">
                  {st.weatherDescription}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-700/50">
                  <span className="flex items-center gap-1">
                    <Droplets className="w-3 h-3 text-cyan-400" /> {st.humidity}%
                  </span>
                  <span className="flex items-center gap-1">
                    <Wind className="w-3 h-3 text-teal-400" /> {st.windSpeed} km/h
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    st.alertLevel === 'red' ? 'bg-rose-500/20 text-rose-400' :
                    st.alertLevel === 'orange' ? 'bg-amber-500/20 text-amber-400' :
                    st.alertLevel === 'yellow' ? 'bg-yellow-400/20 text-yellow-400' :
                    'bg-teal-500/20 text-teal-400'
                  }`}>
                    {st.alertLevel === 'green' ? 'OK' : 'ALLERTA'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

