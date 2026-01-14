
import React, { useState, useEffect } from 'react';
import GameMap from './components/GameMap';
import Sidebar from './components/Sidebar';
import { Coordinate, Territory, User } from './types';
import { MAP_CONFIG } from './constants';
import { 
  Play, Square, MapPin, ShieldCheck, Swords, 
  Menu, Trophy, Navigation, 
  ChevronRight, Loader2, X, Medal, Star,
  History, Clock, ShieldAlert
} from 'lucide-react';
import { getTrainingAdvice, getTerritoryAnalysis } from './services/geminiService';
import { supabase } from './lib/supabase';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [leaderboard, setLeaderboard] = useState<User[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [currentPath, setCurrentPath] = useState<Coordinate[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null);
  const [isRankingOpen, setIsRankingOpen] = useState(false);
  const [aiAdvice, setAiAdvice] = useState("");
  const [lastNotification, setLastNotification] = useState<string | null>(null);
  
  // Persistência de estado do mapa
  const [mapCenter, setMapCenter] = useState<Coordinate>(() => {
    const saved = localStorage.getItem('conquest_run_map_center');
    return saved ? JSON.parse(saved) : MAP_CONFIG.initialCenter;
  });
  const [mapZoom, setMapZoom] = useState<number>(() => {
    const saved = localStorage.getItem('conquest_run_map_zoom');
    return saved ? parseInt(saved, 10) : MAP_CONFIG.initialZoom;
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Auth states
  const [isRegistering, setIsRegistering] = useState(false);
  const [tempEmail, setTempEmail] = useState("");
  const [tempName, setTempName] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [tempColor, setTempColor] = useState("#3b82f6");

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) fetchUserProfile(session.user.id);
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) fetchUserProfile(session.user.id);
      else setCurrentUser(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      setCurrentUser({
        id: data.id,
        name: data.username,
        color: data.color,
        level: data.level,
        xp: data.xp,
        totalDistance: data.total_distance
      });
    }
  };

  const fetchLeaderboard = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('total_distance', { ascending: false })
      .limit(20);
    
    if (data) {
      setLeaderboard(data.map(p => ({
        id: p.id,
        name: p.username,
        color: p.color,
        level: p.level,
        xp: p.xp,
        totalDistance: p.total_distance
      })));
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchLeaderboard();
      const fetchTerritories = async () => {
        const { data } = await supabase.from('territories').select(`*, profiles(username)`);
        if (data) {
          setTerritories(data.map(t => ({
            ...t,
            ownerName: t.profiles?.username || 'Anonimo',
            history: t.history || []
          })));
        }
      };
      fetchTerritories();
    }
  }, [currentUser]);

  useEffect(() => {
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition((position) => {
        const newPoint = { lat: position.coords.latitude, lng: position.coords.longitude };
        // Apenas centraliza automaticamente se estiver gravando
        if (isRecording) {
          setMapCenter(newPoint);
          setCurrentPath(prev => [...prev, newPoint]);
        }
      }, null, { enableHighAccuracy: true });
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [isRecording]);

  useEffect(() => {
    if (currentUser) {
      getTrainingAdvice(currentUser.totalDistance, territories.filter(t => t.ownerId === currentUser.id).length)
        .then(setAiAdvice);
    }
  }, [currentUser, territories.length]);

  const handleAuth = async () => {
    setIsLoading(true);
    if (isRegistering) {
      const { data, error } = await supabase.auth.signUp({
        email: tempEmail,
        password: tempPassword,
        options: { data: { username: tempName, color: tempColor } }
      });
      if (error) setLastNotification(error.message);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: tempEmail, password: tempPassword });
      if (error) setLastNotification(error.message);
    }
    setIsLoading(false);
  };

  const calculateDistance = (path: Coordinate[]) => {
    let total = 0;
    for (let i = 1; i < path.length; i++) {
      const d = Math.sqrt(Math.pow(path[i].lat - path[i-1].lat, 2) + Math.pow(path[i].lng - path[i-1].lng, 2));
      total += d * 111320; 
    }
    return total;
  };

  const checkClosedLoop = (path: Coordinate[]) => {
    if (path.length < 8) return false;
    const start = path[0], end = path[path.length - 1];
    const dist = Math.sqrt(Math.pow(start.lat - end.lat, 2) + Math.pow(start.lng - end.lng, 2));
    return dist < 0.00025;
  };

  const processXP = (currentXP: number, currentLevel: number, gain: number) => {
    let newXP = currentXP + gain;
    let newLevel = currentLevel;
    const xpToNext = currentLevel * 1000;

    if (newXP >= xpToNext) {
      newXP -= xpToNext;
      newLevel += 1;
      setLastNotification(`LEVEL UP! NÍVEL ${newLevel}`);
    }
    return { newXP, newLevel };
  };

  const handleStop = async () => {
    if (!currentUser) return;
    setIsRecording(false);
    const distance = calculateDistance(currentPath);
    const distKm = distance / 1000;
    
    let xpGain = Math.floor(distKm * 100); 
    let captureBonus = 0;

    if (checkClosedLoop(currentPath) && currentPath.length > 5) {
      captureBonus = 500; 
      setLastNotification("Analisando Setor...");
      const lats = currentPath.map(p => p.lat), lngs = currentPath.map(p => p.lng);
      const centroid = { lat: lats.reduce((a,b)=>a+b)/lats.length, lng: lngs.reduce((a,b)=>a+b)/lngs.length };
      
      const eventHistory = [{ date: Date.now(), event: 'captured', user: currentUser.name }];
      
      const { data: savedT } = await supabase.from('territories').insert({
        owner_id: currentUser.id, 
        points: currentPath, 
        area: distance * 10, 
        perimeter: distance, 
        color: currentUser.color, 
        name: `Setor`,
        history: eventHistory
      }).select().single();

      if (savedT) {
        const analysis = await getTerritoryAnalysis(savedT, centroid);
        if (analysis) {
          await supabase.from('territories').update({ name: analysis.newName, strategy: analysis.strategy }).eq('id', savedT.id);
          setLastNotification(`Conquistado: ${analysis.newName} (+${xpGain + captureBonus} XP)`);
        }
      }
    } else {
      xpGain += 50; 
      setLastNotification(`Patrulha Concluída (+${xpGain} XP)`);
    }

    const { newXP, newLevel } = processXP(currentUser.xp, currentUser.level, xpGain + captureBonus);
    const newTotalDist = currentUser.totalDistance + distKm;

    await supabase.from('profiles').update({ 
      total_distance: newTotalDist,
      xp: newXP,
      level: newLevel
    }).eq('id', currentUser.id);

    setCurrentUser(prev => prev ? ({
      ...prev, 
      totalDistance: newTotalDist, 
      xp: newXP, 
      level: newLevel
    }) : null);

    setCurrentPath([]);
    setTimeout(() => setLastNotification(null), 4000);
  };

  const handleViewChange = (center: Coordinate, zoom: number) => {
    setMapCenter(center);
    setMapZoom(zoom);
    localStorage.setItem('conquest_run_map_center', JSON.stringify(center));
    localStorage.setItem('conquest_run_map_zoom', zoom.toString());
  };

  const handleLocate = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        const newPoint = { lat: position.coords.latitude, lng: position.coords.longitude };
        handleViewChange(newPoint, 16);
      });
    }
  };

  const getEventIcon = (event: string) => {
    switch (event) {
      case 'captured': return <Swords size={12} className="text-red-500" />;
      case 'defended': return <ShieldCheck size={12} className="text-green-500" />;
      case 'lost': return <ShieldAlert size={12} className="text-orange-500" />;
      default: return <Clock size={12} className="text-gray-400" />;
    }
  };

  const getEventLabel = (event: string) => {
    switch (event) {
      case 'captured': return 'Conquistado';
      case 'defended': return 'Defendido';
      case 'lost': return 'Perdido';
      default: return 'Evento';
    }
  };

  if (!currentUser) {
    return (
      <div className="h-screen bg-[#0a0f18] flex flex-col items-center justify-center p-6 font-sans">
        <div className="mb-6 text-center">
          <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-900/20">
            <Swords size={24} />
          </div>
          <h1 className="text-2xl font-black tracking-tighter uppercase italic">CONQUEST<span className="text-blue-500">RUN</span></h1>
        </div>
        <div className="w-full max-w-xs bg-gray-900/50 border border-white/5 rounded-xl p-5 space-y-4">
          <div className="flex bg-black/40 p-1 rounded-md">
            <button onClick={() => setIsRegistering(false)} className={`flex-1 py-1.5 rounded text-[9px] font-bold uppercase transition-all ${!isRegistering ? 'bg-blue-600' : 'text-gray-500'}`}>Entrar</button>
            <button onClick={() => setIsRegistering(true)} className={`flex-1 py-1.5 rounded text-[9px] font-bold uppercase transition-all ${isRegistering ? 'bg-blue-600' : 'text-gray-500'}`}>Criar</button>
          </div>
          <div className="space-y-2">
            <input type="email" value={tempEmail} onChange={e=>setTempEmail(e.target.value)} placeholder="E-mail" className="w-full bg-gray-800 border border-white/5 rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:border-blue-500" />
            <input type="password" value={tempPassword} onChange={e=>setTempPassword(e.target.value)} placeholder="Senha" className="w-full bg-gray-800 border border-white/5 rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:border-blue-500" />
            {isRegistering && <input type="text" value={tempName} onChange={e=>setTempName(e.target.value)} placeholder="Codename" className="w-full bg-gray-800 border border-white/5 rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:border-blue-500" />}
          </div>
          <button onClick={handleAuth} disabled={isLoading} className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center">
            {isLoading ? <Loader2 className="animate-spin" size={16} /> : (isRegistering ? 'Confirmar' : 'Acessar')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0a0f18] text-white overflow-hidden select-none font-sans">
      <Sidebar currentUser={currentUser} territories={territories} leaderboard={leaderboard.slice(0, 5)} aiAdvice={aiAdvice} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <main className="flex-1 relative flex flex-col">
        <div className="absolute top-4 left-4 z-40">
          <button onClick={() => setIsSidebarOpen(true)} className="w-9 h-9 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg flex items-center justify-center hover:bg-black/80 transition-all">
            <Menu size={16} />
          </button>
        </div>

        <div className="flex-1">
          <GameMap 
            currentPath={currentPath} 
            territories={territories} 
            center={mapCenter} 
            zoom={mapZoom}
            onTerritoryClick={setSelectedTerritory} 
            isRecording={isRecording}
            onViewChange={handleViewChange}
          />
        </div>

        {/* Modal de Detalhes do Território com Histórico */}
        {selectedTerritory && (
          <div className="absolute inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm px-4 pb-8" onClick={() => setSelectedTerritory(null)}>
            <div className="bg-[#0a0f18] border border-white/10 w-full max-w-sm rounded-2xl p-5 shadow-2xl animate-in slide-in-from-bottom-8 flex flex-col max-h-[85vh]" onClick={e=>e.stopPropagation()}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tight leading-tight">{selectedTerritory.name}</h2>
                  <p className="text-gray-400 text-[9px] uppercase font-black tracking-[0.2em] mt-0.5">Operador Atual: {selectedTerritory.ownerName}</p>
                </div>
                <button onClick={() => setSelectedTerritory(null)} className="p-1 hover:bg-white/5 rounded-lg transition-colors">
                  <X size={18} className="text-gray-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-5 custom-scrollbar pr-1">
                <section>
                  <div className="flex items-center space-x-2 mb-2">
                    <History size={12} className="text-blue-500" />
                    <h3 className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Informação Estratégica</h3>
                  </div>
                  <div className="bg-blue-950/20 border border-blue-900/20 p-3 rounded-xl italic">
                    <p className="text-[10px] text-blue-100 leading-relaxed leading-relaxed">
                      "{selectedTerritory.strategy || 'Nenhuma estratégia registrada para este setor.'}"
                    </p>
                  </div>
                </section>

                <section>
                  <div className="flex items-center space-x-2 mb-3">
                    <Clock size={12} className="text-yellow-500" />
                    <h3 className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Log de Eventos do Setor</h3>
                  </div>
                  <div className="space-y-2">
                    {selectedTerritory.history && selectedTerritory.history.length > 0 ? (
                      [...selectedTerritory.history]
                        .sort((a, b) => b.date - a.date)
                        .map((entry, idx) => (
                          <div key={idx} className="bg-gray-900/40 border border-white/5 rounded-xl p-2.5 flex items-center justify-between group hover:bg-gray-800/40 transition-all">
                            <div className="flex items-center space-x-3">
                              <div className="w-7 h-7 bg-black/40 rounded-lg flex items-center justify-center border border-white/5">
                                {getEventIcon(entry.event)}
                              </div>
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-tight leading-none mb-0.5">{getEventLabel(entry.event)}</p>
                                <p className="text-[8px] text-gray-500 font-bold">Por: {entry.user}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] font-mono text-gray-400 leading-none">
                                {new Date(entry.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                              </p>
                              <p className="text-[8px] font-mono text-gray-600 uppercase mt-0.5">
                                {new Date(entry.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="text-center py-4 border border-dashed border-white/5 rounded-xl">
                        <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest">Nenhum histórico disponível</p>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <div className="mt-5 pt-4 border-t border-white/5 flex gap-2">
                <button 
                  onClick={() => setSelectedTerritory(null)} 
                  className="flex-1 py-3 bg-gray-800/80 hover:bg-gray-700 rounded-xl font-bold uppercase text-[9px] tracking-widest transition-all"
                >
                  Fechar Registro
                </button>
              </div>
            </div>
          </div>
        )}

        {isRankingOpen && (
          <div className="absolute inset-0 z-[110] flex flex-col bg-[#0a0f18] animate-in slide-in-from-right-full duration-300">
            <div className="p-4 flex items-center justify-between border-b border-white/5 bg-gray-950/50">
              <div className="flex items-center space-x-3">
                <Trophy size={18} className="text-yellow-500" />
                <h2 className="text-sm font-black uppercase tracking-widest">Ranking Global</h2>
              </div>
              <button onClick={() => setIsRankingOpen(false)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {leaderboard.map((user, idx) => {
                const isTop3 = idx < 3;
                const colors = ['text-yellow-400', 'text-gray-300', 'text-amber-600'];
                return (
                  <div 
                    key={user.id} 
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      user.id === currentUser.id ? 'bg-blue-600/20 border-blue-500/50' : 'bg-gray-900/40 border-white/5'
                    } ${isTop3 ? 'scale-[1.02] shadow-lg' : ''}`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-6 text-center font-black text-[10px] font-mono opacity-50">
                        {idx + 1}
                      </div>
                      <div className={`relative`}>
                        <div className="w-9 h-9 rounded-lg border flex items-center justify-center font-black text-xs shadow-inner" style={{ borderColor: user.color, backgroundColor: `${user.color}15` }}>
                          {user.name[0]}
                        </div>
                        {isTop3 && (
                          <div className={`absolute -top-1 -right-1 ${colors[idx]}`}>
                            <Medal size={14} fill="currentColor" />
                          </div>
                        )}
                      </div>
                      <div>
                        <span className={`text-xs font-black block leading-none uppercase tracking-tight ${isTop3 ? colors[idx] : ''}`}>{user.name}</span>
                        <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest">Nível {user.level}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-white leading-none">{user.totalDistance.toFixed(1)}</p>
                      <p className="text-[7px] text-gray-600 font-bold uppercase tracking-tighter">km total</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="absolute top-16 left-0 right-0 z-40 flex justify-center px-6 pointer-events-none">
          {lastNotification && (
            <div className="bg-blue-600 px-5 py-2.5 rounded-lg shadow-xl flex items-center space-x-3 animate-in slide-in-from-top-4 border border-white/20">
              <Star size={14} className="animate-spin-slow" />
              <span className="text-[9px] font-black uppercase tracking-widest">{lastNotification}</span>
            </div>
          )}
        </div>

        <div className="p-4 z-40 space-y-4">
          {isRecording && (
            <div className="bg-black/80 backdrop-blur-xl border border-white/5 p-3 rounded-xl flex justify-around w-full max-w-[280px] mx-auto shadow-2xl">
              <div className="text-center">
                <p className="text-[7px] text-gray-500 uppercase font-black tracking-tighter">Distância</p>
                <p className="text-base font-black text-blue-400">{(calculateDistance(currentPath)/1000).toFixed(2)} km</p>
              </div>
              <div className="text-center">
                <p className="text-[7px] text-gray-500 uppercase font-black tracking-tighter">Perímetro</p>
                <div className={`text-[8px] font-black uppercase mt-1 ${checkClosedLoop(currentPath) ? 'text-green-400' : 'text-yellow-400'}`}>
                  {checkClosedLoop(currentPath) ? 'Fechado' : 'Mapeando'}
                </div>
              </div>
            </div>
          )}
          
          <div className="flex items-end justify-center space-x-6 pb-2">
            <div className="flex flex-col items-center space-y-1">
              <button onClick={handleLocate} className="w-10 h-10 bg-gray-900/80 border border-white/10 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-all shadow-lg active:scale-90">
                <MapPin size={18}/>
              </button>
              <span className="text-[7px] font-black uppercase tracking-widest text-gray-600">Focar</span>
            </div>

            <div className="flex flex-col items-center space-y-1">
              {!isRecording ? (
                <button onClick={() => setIsRecording(true)} className="bg-blue-600 w-16 h-16 rounded-2xl shadow-lg shadow-blue-900/40 flex items-center justify-center active:scale-95 transition-all group">
                  <Play size={28} fill="currentColor" className="ml-1 text-white group-hover:scale-110 transition-transform" />
                </button>
              ) : (
                <button onClick={handleStop} className="bg-red-600 w-16 h-16 rounded-2xl shadow-lg shadow-red-900/40 flex items-center justify-center animate-pulse active:scale-95 transition-all"
                >
                  <Square size={24} fill="currentColor" className="text-white" />
                </button>
              )}
              <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${isRecording ? 'text-red-500' : 'text-blue-500'}`}>
                {isRecording ? 'Parar' : 'Correr'}
              </span>
            </div>

            <div className="flex flex-col items-center space-y-1">
              <button onClick={() => setIsRankingOpen(true)} className="w-10 h-10 bg-gray-900/80 border border-white/10 rounded-xl flex items-center justify-center text-gray-400 hover:text-yellow-500 transition-all shadow-lg active:scale-90">
                <Trophy size={18}/>
              </button>
              <span className="text-[7px] font-black uppercase tracking-widest text-gray-600">Ranking</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
