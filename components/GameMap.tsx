
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Territory, Coordinate } from '../types';

interface GameMapProps {
  currentPath: Coordinate[];
  territories: Territory[];
  center: Coordinate;
  onTerritoryClick: (territory: Territory) => void;
  isRecording: boolean;
}

const GameMap: React.FC<GameMapProps> = ({ currentPath, territories, center, onTerritoryClick, isRecording }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pathLayerRef = useRef<L.Polyline | null>(null);
  const territoryLayersRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map
    mapRef.current = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView([center.lat, center.lng], 16);

    // Dark Mode Tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20
    }).addTo(mapRef.current);

    // Camada de rastro do jogador
    pathLayerRef.current = L.polyline([], { 
      color: '#3b82f6', 
      weight: 5, 
      opacity: 0.9,
      lineJoin: 'round'
    }).addTo(mapRef.current);
    
    // Camada de territórios
    territoryLayersRef.current = L.layerGroup().addTo(mapRef.current);

    // Ícone personalizado de localização
    const userIcon = L.divIcon({
      className: 'user-location-marker',
      html: '<div class="marker-pulse"></div><div class="marker-dot"></div>',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    // Marcador de localização exata
    userMarkerRef.current = L.marker([center.lat, center.lng], { 
      icon: userIcon,
      zIndexOffset: 1000 
    }).addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
    };
  }, []);

  // Monitorar mudança de estado de gravação para efeitos visuais no path
  useEffect(() => {
    if (pathLayerRef.current) {
      pathLayerRef.current.setStyle({
        dashArray: isRecording ? '1, 10' : undefined
      });
    }
  }, [isRecording]);

  // Atualizar posição do marcador de localização e centralizar se necessário
  useEffect(() => {
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([center.lat, center.lng]);
    }

    if (mapRef.current && !isRecording) {
      mapRef.current.flyTo([center.lat, center.lng], mapRef.current.getZoom(), {
        animate: true,
        duration: 1.0
      });
    }
  }, [center, isRecording]);

  // Update Path e acompanhamento durante a gravação
  useEffect(() => {
    if (pathLayerRef.current && currentPath.length > 0) {
      const latlngs = currentPath.map(p => [p.lat, p.lng] as [number, number]);
      pathLayerRef.current.setLatLngs(latlngs);
      
      // Durante a gravação, mantém o foco na última posição
      if (isRecording && mapRef.current) {
        mapRef.current.panTo(latlngs[latlngs.length - 1]);
      }
    } else if (pathLayerRef.current && currentPath.length === 0) {
      pathLayerRef.current.setLatLngs([]);
    }
  }, [currentPath, isRecording]);

  // Update Territories
  useEffect(() => {
    if (territoryLayersRef.current) {
      territoryLayersRef.current.clearLayers();
      territories.forEach(t => {
        const poly = L.polygon(t.points.map(p => [p.lat, p.lng] as [number, number]), {
          fillColor: t.color,
          fillOpacity: 0.4,
          color: t.color,
          weight: 2,
          className: 'cursor-pointer'
        });
        
        poly.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onTerritoryClick(t);
        });
        
        territoryLayersRef.current?.addLayer(poly);
      });
    }
  }, [territories, onTerritoryClick]);

  return <div ref={mapContainerRef} className="w-full h-full z-0" />;
};

export default GameMap;
