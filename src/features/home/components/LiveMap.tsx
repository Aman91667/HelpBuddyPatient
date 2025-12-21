// @ts-nocheck
import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import clsx from 'clsx';

// Fix Leaflet marker icon issue (use CDN fallback)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface LiveMapProps {
  onAddress?: (address: string) => void;
  height?: string; // CSS height e.g. '68vh' or '420px'
  initialCenter?: [number, number];
  zoom?: number;
}

// A small component to add map controls (center to current location)
function MapControls({ setCenter }: { setCenter: (c: [number, number]) => void }) {
  const map = useMap();

  return (
    <div className="absolute right-4 top-4 flex flex-col gap-2 z-50">
      <button
        aria-label="locate"
        className="h-10 w-10 rounded-lg bg-white/90 shadow-sm flex items-center justify-center"
        onClick={() => {
          map.locate({ setView: true, maxZoom: map.getZoom() });
        }}
      >
        <svg className="w-5 h-5 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4 12h4"/><path d="M16 12h4"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
    </div>
  );
}

const createPulseIcon = (color = '#059669') => {
  // divIcon with a pulsating span; styling applied via inline style and class
  const html = `
    <span class="live-marker-root" style="display:inline-block;position:relative;">
      <span style="width:14px;height:14px;border-radius:9999px;background:${color};display:block;box-shadow:0 0 0 6px rgba(5,150,105,0.12);"></span>
      <span class="live-marker-pulse" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:14px;height:14px;border-radius:9999px;background:${color};opacity:0.35;box-shadow:0 0 0 6px rgba(5,150,105,0.12);"></span>
    </span>
  `;
  return L.divIcon({ html, className: 'live-div-icon', iconAnchor: [7, 7] });
};

const LocationMarker = ({ onAddress, setSelectedLatLng }: { onAddress?: (address: string) => void; setSelectedLatLng?: (pos: [number, number] | null) => void }) => {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const map = useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setPosition([lat, lng]);
      if (setSelectedLatLng) setSelectedLatLng([lat, lng]);

      // Reverse geocoding to get address (Nominatim)
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.display_name && onAddress) onAddress(data.display_name);
        })
        .catch((err) => console.error('Geocoding error:', err));
    },
    locationfound(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  useEffect(() => {
    map.locate();
  }, [map]);

  return position === null ? null : (
    <Marker position={position} icon={createPulseIcon()}>
      <Popup className="text-sm">Selected location<br/><small className="text-muted">Click again to update</small></Popup>
    </Marker>
  );
};

const LiveMap = ({ onAddress, height = '68vh', initialCenter = [26.9124, 75.7873], zoom = 17 }: LiveMapProps) => {
  const [center, setCenter] = useState<[number, number]>(initialCenter);
  const [selectedLatLng, setSelectedLatLng] = useState<[number, number] | null>(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCenter([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          // keep default center
          console.error('Geolocation error:', error);
        }
      );
    }
  }, []);

  return (
    <div className={clsx('live-map-wrapper relative rounded-2xl overflow-hidden')} style={{ height }}>
      <MapContainer 
        center={center} 
        zoom={zoom} 
        style={{ height: '100%', width: '100%' }} 
        ref={mapRef}
        scrollWheelZoom={true}
        zoomControl={true}
        maxZoom={19}
        minZoom={15}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <LocationMarker onAddress={onAddress} setSelectedLatLng={setSelectedLatLng} />

        {/* Optionally show a marker for user's detected center */}
        {center && <Marker position={center} icon={createPulseIcon('#2563EB')} />}

        <MapControls setCenter={setCenter} />
      </MapContainer>

      {/* Small floating footer to show selected address */}
      <div className="absolute left-4 bottom-4 w-[calc(100%-32px)] sm:w-96">
        <div className="p-3 rounded-xl bg-white/95 backdrop-blur border border-gray-100 shadow flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-emerald-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 12-9 12S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">Selected location</div>
            <div className="text-xs text-slate-600 truncate">{selectedLatLng ? `${selectedLatLng[0].toFixed(4)}, ${selectedLatLng[1].toFixed(4)}` : 'Tap anywhere on the map'}</div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-sm text-slate-700 mr-2">Tap to confirm</div>
            <button className="h-9 px-3 rounded-lg bg-emerald-500 text-white" onClick={() => {
              if (selectedLatLng && onAddress) {
                // reverse geocode and send final address again
                fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${selectedLatLng[0]}&lon=${selectedLatLng[1]}`)
                  .then((r) => r.json())
                  .then((d) => { if (d.display_name) onAddress(d.display_name); })
                  .catch(() => {});
              }
            }}>Confirm</button>
          </div>
        </div>
      </div>

      <style>{`
        .live-marker-pulse { animation: pulse 1500ms infinite ease-out; transform-origin: center; }
        @keyframes pulse { 0% { transform: translate(-50%,-50%) scale(0.8); opacity: 0.6 } 70% { transform: translate(-50%,-50%) scale(2.2); opacity: 0 } 100% { transform: translate(-50%,-50%) scale(2.2); opacity: 0 } }
      `}</style>
    </div>
  );
};

export default LiveMap;
