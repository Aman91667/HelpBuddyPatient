// removed @ts-nocheck to keep TypeScript checks active
import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import type { Location } from '@/types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// Leaflet markercluster plugin and styles (provides clustering + spiderfy)
// @ts-ignore - module may not have types
import 'leaflet.markercluster/dist/MarkerCluster.css';
// @ts-ignore
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
// @ts-ignore
import 'leaflet.markercluster';

// Fix for default markers
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom larger icons for better visibility at high zoom
const patientIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: iconShadow,
  iconSize: [35, 57],
  iconAnchor: [17, 57],
  popupAnchor: [1, -44],
});

const helperIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: iconShadow,
  iconSize: [35, 57],
  iconAnchor: [17, 57],
  popupAnchor: [1, -44],
});

interface MapProps {
  center: Location;
  markers?: Array<{
    position: Location;
    popup?: string;
    type?: 'patient' | 'helper';
  }>;
  zoom?: number;
  height?: string;
  fitToMarkers?: boolean;
  className?: string;
}

const ViewController = ({
  center,
  markers,
  fitToMarkers,
}: {
  center: Location;
  markers: MapProps['markers'];
  fitToMarkers?: boolean;
}) => {
  const map = useMap();

  useEffect(() => {
    if (!center || typeof center.lat !== 'number' || typeof center.lng !== 'number') return;

    const markerPositions = (markers || [])
      .map((marker) => {
        if (!marker?.position) return null;
        const { lat, lng } = marker.position;
        if (typeof lat !== 'number' || typeof lng !== 'number') return null;
        return [lat, lng] as [number, number];
      })
      .filter(Boolean) as [number, number][];

    if (fitToMarkers && markerPositions.length >= 1) {
      const bounds = L.latLngBounds([...markerPositions, [center.lat, center.lng]]);
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 18 });
      return;
    }

    map.setView([center.lat, center.lng]);
  }, [
    center?.lat,
    center?.lng,
    fitToMarkers,
    map,
    JSON.stringify(
      (markers || []).map((m) =>
        m?.position ? [Number(m.position.lat?.toFixed?.(4) ?? m.position.lat), Number(m.position.lng?.toFixed?.(4) ?? m.position.lng)] : null,
      ),
    ),
  ]);

  return null;
};

export const Map = ({ center, markers = [], zoom = 17, height = '400px', fitToMarkers = false, className = '' }: MapProps) => {
  // Guard: center must have numeric lat/lng
  const hasCenter = center && typeof center.lat === 'number' && typeof center.lng === 'number';

  if (!hasCenter) {
    return (
      <div
        className={`w-full rounded-2xl border border-border bg-card flex items-center justify-center text-muted-foreground ${className}`}
        style={{ height }}
      >
        <span>Location unavailable</span>
      </div>
    );
  }

  const centerPos: [number, number] = [center.lat, center.lng];

  // Allow callers to request a viewport-aware full-height map using the
  // special height token `calc-vh`. This computes: 100vh - header - bottom.
  let resolvedHeight =
    height === 'calc-vh'
      ? `calc(100vh - var(--app-header-height,64px) - var(--app-bottom-height,88px))`
      : height;

  // On small screens prefer a compact map height to avoid overlapping other UI
  if (typeof window !== 'undefined' && window.innerWidth < 640) {
    if (height === 'calc-vh') {
      resolvedHeight = `calc(60vh - var(--app-header-height,64px))`;
    } else {
      resolvedHeight = '50vh';
    }
  }

  // Simple de-cluttering: group markers that are very close and spread them
  const clusterNearbyMarkers = (markersList: MapProps['markers'], currentZoom: number) => {
    if (!markersList || markersList.length <= 1) return (markersList || []).map(m => ({ ...m, adjustedPos: m.position }));

    // Haversine distance (meters)
    const distMeters = (a: Location, b: Location) => {
      const R = 6371000; // meters
      const toRad = (d: number) => (d * Math.PI) / 180;
      const dLat = toRad(b.lat - a.lat);
      const dLon = toRad(b.lng - a.lng);
      const lat1 = toRad(a.lat);
      const lat2 = toRad(b.lat);
      const sinLat = Math.sin(dLat / 2);
      const sinLon = Math.sin(dLon / 2);
      const aHar = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
      const c = 2 * Math.atan2(Math.sqrt(aHar), Math.sqrt(1 - aHar));
      return R * c;
    };

    const groups: Location[][] = [];

    markersList.forEach((m) => {
      const pos = m.position as Location;
      let placed = false;
      for (const g of groups) {
        if (distMeters(g[0], pos) < 20) { // threshold: 20 meters
          g.push(pos);
          placed = true;
          break;
        }
      }
      if (!placed) groups.push([pos]);
    });

    // Map each original marker to adjusted position
    const adjusted: any[] = [];

    groups.forEach((group) => {
      if (group.length === 1) {
        // find index of marker with this pos
        const idx = markersList.findIndex(m => m.position.lat === group[0].lat && m.position.lng === group[0].lng);
        adjusted.push({ ...markersList[idx], adjustedPos: group[0] });
      } else {
        const center = group[0];
        // radial offsets for each marker
        const n = group.length;
        // radius depends slightly on zoom to avoid too large offsets at low zooms
        const baseRadius = Math.max(8, 12 * (18 - Number(zoom || currentZoom)) / 3 + 8);
        for (let i = 0; i < n; i++) {
          const angle = (2 * Math.PI * i) / n;
          const radiusMeters = baseRadius + (i * 4);
          const latOffset = (radiusMeters * Math.cos(angle)) / 111111; // ~ meters to degrees
          const lngOffset = (radiusMeters * Math.sin(angle)) / (111111 * Math.cos((center.lat * Math.PI) / 180));

          // find a marker matching this location that doesn't yet have an adjustedPos
          const matchIndex = markersList.findIndex((mm) => {
            return mm.position.lat === group[i].lat && mm.position.lng === group[i].lng && adjusted.findIndex(a => a === mm) === -1;
          });

          // fallback: match by proximity
          const fallbackIndex = markersList.findIndex((mm) => distMeters(mm.position, group[0]) < 20 && !adjusted.some(a => a === mm));
          const usedIndex = matchIndex !== -1 ? matchIndex : fallbackIndex;
          if (usedIndex === -1) continue;

          const orig = markersList[usedIndex];
          const adjustedLat = orig.position.lat + latOffset;
          const adjustedLng = orig.position.lng + lngOffset;
          adjusted.push({ ...orig, adjustedPos: { lat: adjustedLat, lng: adjustedLng } });
        }
      }
    });

    // If some markers weren't added (edge cases), append them with original positions
    markersList.forEach((m) => {
      if (!adjusted.find(a => a === m || (a.position && a.position.lat === m.position.lat && a.position.lng === m.position.lng))) {
        adjusted.push({ ...m, adjustedPos: m.position });
      }
    });

    return adjusted;
  };

  const adjustedMarkers = clusterNearbyMarkers(markers, zoom);

  // Component wrapper for markercluster plugin so hooks run inside React render tree
  const MarkerClusterLayer = ({ markers: clusterMarkers }: { markers: MapProps['markers'] }) => {
    const map = useMap();

    useEffect(() => {
      // @ts-ignore - plugin may not have types
      const Cluster = (L as any).markerClusterGroup;
      if (!Cluster) return;
      const group = Cluster({ spiderfyOnMaxZoom: true, showCoverageOnHover: true, maxClusterRadius: 50, disableClusteringAtZoom: 18 });

      (clusterMarkers || []).forEach((m) => {
        if (!m?.position) return;
        const icon = m.type === 'helper' ? helperIcon : patientIcon;
        const mk = L.marker([m.position.lat, m.position.lng], { icon });
        if (m.popup) mk.bindPopup(String(m.popup));
        group.addLayer(mk);
      });

      map.addLayer(group);
      return () => {
        try { map.removeLayer(group); } catch (e) { /* ignore */ }
      };
    }, [map, JSON.stringify(clusterMarkers || [])]);

    return null;
  };

  return (
    <div className={`w-full rounded-2xl border border-border bg-card shadow-xl overflow-hidden ${className}`} style={{ height: resolvedHeight, paddingBottom: typeof window !== 'undefined' && window.innerWidth < 640 ? '4.5rem' : undefined }}>
      <MapContainer
        center={centerPos}
        zoom={zoom}
        scrollWheelZoom={true}
        zoomControl={true}
        style={{ height: '100%', width: '100%' }}
        maxZoom={19}
        minZoom={15}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <ViewController center={center} markers={markers} fitToMarkers={fitToMarkers} />

        {/* Marker cluster layer (uses plugin when available) */}
        {
          // @ts-ignore
          (L as any).markerClusterGroup ? (
            <MarkerClusterLayer markers={markers} />
          ) : (
            adjustedMarkers.map((marker, index) => {
              // Guard: marker.position must be valid
              const hasPos = marker && marker.adjustedPos && typeof marker.adjustedPos.lat === 'number' && typeof marker.adjustedPos.lng === 'number';
              if (!hasPos) return null;

              const pos: [number, number] = [marker.adjustedPos.lat, marker.adjustedPos.lng];
              const markerIcon = marker.type === 'helper' ? helperIcon : patientIcon;

              return (
                <Marker key={index} position={pos} icon={markerIcon}>
                  {marker.popup && <Popup>{marker.popup}</Popup>}
                </Marker>
              );
            })
          )
        }
      </MapContainer>
    </div>
  );
};
