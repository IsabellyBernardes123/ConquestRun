
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
  event: 'captured' | 'defended' | 'lost';
  user: string;
}

export interface Territory {
  id: string;
  ownerId: string;
  ownerName: string;
  points: Coordinate[];
  area: number; // in square meters
  perimeter: number; // in meters
  capturedAt: number;
  color: string;
  name: string;
  history: TerritoryHistory[];
  defenses: number;
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
}

export interface Activity {
  id: string;
  userId: string;
  path: Coordinate[];
  distance: number;
  duration: number;
  timestamp: number;
  isClosed: boolean;
}
