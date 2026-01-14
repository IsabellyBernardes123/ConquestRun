
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Territory, Coordinate } from '../types';

interface GameMapProps {
  currentPath: Coordinate[];
  territories: Territory[];
  center: Coordinate;
  onTerritoryClick: (territory: Territory) => void;
}

const GameMap: React.FC<GameMapProps> = ({ currentPath, territories, center, onTerritoryClick }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pathLayerRef = useRef<L.Polyline | null>(null);
  const territoryLayersRef = useRef<L.LayerGroup | null>(null);

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

    pathLayerRef.current = L.polyline([], { color: '#3b82f6', weight: 4, opacity: 0.8 }).addTo(mapRef.current);
    territoryLayersRef.current = L.layerGroup().addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
    };
  }, []);

  // Update Path
  useEffect(() => {
    if (pathLayerRef.current && currentPath.length > 0) {
      const latlngs = currentPath.map(p => [p.lat, p.lng] as [number, number]);
      pathLayerRef.current.setLatLngs(latlngs);
      
      if (mapRef.current && currentPath.length % 5 === 0) {
        mapRef.current.panTo(latlngs[latlngs.length - 1]);
      }
    }
  }, [currentPath]);

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
