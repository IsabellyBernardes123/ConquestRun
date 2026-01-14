
export interface Coordinate {
  lat: number;
  lng: number;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface TerritoryHistory {
  date: number;
  event: 'captured' | 'defended' | 'lost' | 'fortified';
  user: string;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  target: number;
  current: number;
  xpReward: number;
  type: 'distance' | 'capture' | 'fortify';
  completed: boolean;
}

export interface Territory {
  id: string;
  ownerId: string;
  ownerName: string;
  points: Coordinate[];
  area: number; 
  perimeter: number; 
  capturedAt: number;
  color: string;
  name: string;
  history: TerritoryHistory[];
  defenses: number;
  fortificationLevel: number;
  strategy?: string;
  sources?: GroundingSource[];
}

export interface User {
  id: string;
  name: string;
  color: string;
  level: number;
  xp: number;
  totalDistance: number;
  rankTitle: string;
}
