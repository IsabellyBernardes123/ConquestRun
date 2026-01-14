
import { User, Territory } from './types';

export const MOCK_USERS: User[] = [
  // Fixed missing rankTitle property
  { id: '1', name: 'Você', color: '#3b82f6', level: 5, xp: 1250, totalDistance: 45.2, rankTitle: 'Batedor Urbano' },
  { id: '2', name: 'Marcos_Ninja', color: '#ef4444', level: 8, xp: 2100, totalDistance: 88.5, rankTitle: 'Operador Fantasma' },
  { id: '3', name: 'Ana_Runner', color: '#10b981', level: 4, xp: 900, totalDistance: 32.1, rankTitle: 'Recruta' },
];

export const INITIAL_TERRITORIES: Territory[] = [
  {
    id: 't1',
    ownerId: '2',
    ownerName: 'Marcos_Ninja',
    points: [
      { lat: -23.55052, lng: -46.633308 },
      { lat: -23.55152, lng: -46.633308 },
      { lat: -23.55152, lng: -46.634308 },
      { lat: -23.55052, lng: -46.634308 }
    ],
    area: 10000,
    perimeter: 400,
    capturedAt: Date.now() - 86400000,
    color: '#ef4444',
    name: 'Distrito Central',
    defenses: 12,
    // Fixed missing fortificationLevel property
    fortificationLevel: 1,
    strategy: 'Mantenha um ritmo constante no perímetro norte para evitar infiltrações.',
    history: [
      { date: Date.now() - 86400000, event: 'captured', user: 'Marcos_Ninja' },
      { date: Date.now() - 43200000, event: 'defended', user: 'Marcos_Ninja' },
      { date: Date.now() - 10800000, event: 'defended', user: 'Marcos_Ninja' }
    ]
  }
];

export const MAP_CONFIG = {
  initialCenter: { lat: -23.55052, lng: -46.633308 } as const,
  initialZoom: 15,
};
