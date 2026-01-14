
import React, { useState, useEffect } from 'react';
import GameMap from './components/GameMap';
import Sidebar from './components/Sidebar';
import { Coordinate, Territory, User, Mission } from './types';
import { MAP_CONFIG } from './constants';
import { 
  Play, Square, MapPin, Swords, 
  Menu, Trophy, Loader2, X, Star,
  Clock, ShieldAlert, Award, Shield,
  Terminal, Activity, Lock, User as UserIcon,
  Target
} from 'lucide-react';
import { getTrainingAdvice, getTerritoryAnalysis, generateDailyMissions } from './services/geminiService';
import { supabase } from './lib/supabase';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [leaderboard, setLeaderboard] = useState<User[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [currentPath, setCurrentPath] = useState<Coordinate[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null);
  const [isRankingOpen, setIsRankingOpen] = useState(false);
  const [aiAdvice, setAiAdvice] = useState("");
  const [lastNotification, setLastNotification] = useState<string | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  
  const [mapCenter, setMapCenter] = useState<Coordinate>(() => {
    try {
      const saved = localStorage.getItem('conquest_run_map_center');
      return saved ? JSON.parse(saved) : MAP_CONFIG.initialCenter;
    } catch { return MAP_CONFIG.initialCenter; }
  });
  
  const [mapZoom, setMapZoom] = useState<number>(() => {
    const saved = localStorage.getItem('conquest_run_map_zoom');
    return saved ? parseInt(saved, 10) : MAP_CONFIG.initialZoom;
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Login States
  const [isRegistering, setIsRegistering] = useState(false);
  const [tempEmail, setTempEmail] = useState("");
  const [tempName, setTempName] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [tempColor, setTempColor] = useState("#3b82f6");

  useEffect(() => {
    const setup = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (session?.user) {
          await fetchUserProfile(session.user.id);
        }
      } catch (err) {
        console.error("Erro ao inicializar sessão:", err);
      } finally {
        setIsInitializing(false);
      }
    };
    setup();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) fetchUserProfile(session.user.id);
      else setCurrentUser(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const getRankTitle = (level: number) => {
    if (level < 3) return "Recruta";
    if (level < 7) return "Batedor Urbano";
    if (level < 12) return "Operador Fantasma";
    if (level < 20) return "Comandante de Elite";
    return "Lenda das Ruas";
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (error) throw error;
      if (data) {
        const user: User = {
          id: data.id,
          name: data.username,
          color: data.color,
          level: data.level,
          xp: data.xp,
          totalDistance: data.total_distance,
          rankTitle: getRankTitle(data.level)
        };
        setCurrentUser(user);
        
        const savedMissions = localStorage.getItem(`missions_${userId}`);
        if (savedMissions) {
          setMissions(JSON.parse(savedMissions));
        } else {
          const newMissions = await generateDailyMissions(user.level);
          setMissions(newMissions);
          localStorage.setItem(`missions_${userId}`, JSON.stringify(newMissions));
        }
      }
    } catch (err) {
      console.error("Erro ao carregar perfil:", err);
    }
  };

  const handleAuth = async () => {
    if (!tempEmail || !tempPassword) {
      setLastNotification("Preencha todos os campos.");
      return;
    }
    
    setIsLoading(true);
    try {
      if (isRegistering) {
        const { error } = await supabase.auth.signUp({
          email: tempEmail,
          password: tempPassword,
          options: { data: { username: tempName || 'OPERADOR', color: tempColor } }
        });
        if (error) throw error;
        setLastNotification("Alistamento concluído! Verifique seu e-mail.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: tempEmail, password: tempPassword });
        if (error) throw error;
      }
    } catch (error: any) {
      setLastNotification("Falha: " + error.message);
    } finally {
      setIsLoading(false);
      setTimeout(() => setLastNotification(null), 5000);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setIsSidebarOpen(false);
  };

  const updateMissionProgress = (type: 'distance' | 'capture' | 'fortify', amount: number) => {
    setMissions(prev => {
      const next = prev.map(m => {
        if (m.type === type && !m.completed) {
          const newCurrent = m.current + amount;
          const isNowCompleted = newCurrent >= m.target;
          if (isNowCompleted) setLastNotification(`MISSÃO CUMPRIDA: ${m.title} (+${m.xpReward} XP)`);
          return { ...m, current: newCurrent, completed: isNowCompleted };
        }
        return m;
      });
      if (currentUser) localStorage.setItem(`missions_${currentUser.id}`, JSON.stringify(next));
      return next;
    });
  };

  const fetchLeaderboard = async () => {
    const { data } = await supabase.from('profiles').select('*').order('total_distance', { ascending: false }).limit(20);
    if (data) setLeaderboard(data.map(p => ({
      id: p.id, name: p.username, color: p.color, level: p.level, xp: p.xp, totalDistance: p.total_distance, rankTitle: getRankTitle(p.level)
    })));
  };

  useEffect(() => {
    if (currentUser) {
      fetchLeaderboard();
      const fetchTerritories = async () => {
        const { data } = await supabase.from('territories').select(`*, profiles(username)`);
        if (data) setTerritories(data.map(t => ({
          ...t, ownerName: t.profiles?.username || 'Anonimo', history: t.history || [], fortificationLevel: t.fortification_level || 1
        })));
      };
      fetchTerritories();
      getTrainingAdvice(currentUser.totalDistance, territories.length).then(setAiAdvice);
    }
  }, [currentUser, territories.length]);

  useEffect(() => {
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition((position) => {
        const newPoint = { lat: position.coords.latitude, lng: position.coords.longitude };
        if (isRecording) {
          setMapCenter(newPoint);
          setCurrentPath(prev => [...prev, newPoint]);
        }
      }, (err) => console.error("Erro de GPS:", err), { enableHighAccuracy: true });
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [isRecording]);

  const calculateDistance = (path: Coordinate[]) => {
    let total = 0;
    for (let i = 1; i < path.length; i++) {
      const d = Math.sqrt(Math.pow(path[i].lat - path[i-1].lat, 2) + Math.pow(path[i].lng - path[i-1].lng, 2));
      total += d * 111320; 
    }
    return total;
  };

  const handleStop = async () => {
    if (!currentUser) return;
    setIsRecording(false);
    const distance = calculateDistance(currentPath);
    const distKm = distance / 1000;
    
    let xpGain = Math.floor(distKm * 100); 
    let captureBonus = 0;

    updateMissionProgress('distance', distKm);

    if (distKm > 0.05 && currentPath.length > 5) {
      const isClosed = (path: Coordinate[]) => {
        const start = path[0], end = path[path.length - 1];
        return Math.sqrt(Math.pow(start.lat-end.lat, 2) + Math.pow(start.lng-end.lng, 2)) < 0.00025;
      };

      if (isClosed(currentPath)) {
        captureBonus = 500;
        updateMissionProgress('capture', 1);
        setLastNotification("SETOR CONQUISTADO!");
        
        const lats = currentPath.map(p => p.lat), lngs = currentPath.map(p => p.lng);
        const centroid = { lat: lats.reduce((a,b)=>a+b)/lats.length, lng: lngs.reduce((a,b)=>a+b)/lngs.length };
        
        const { data: savedT } = await supabase.from('territories').insert({
          owner_id: currentUser.id, points: currentPath, area: distance * 10, perimeter: distance, 
          color: currentUser.color, name: `Setor Recon`, history: [{ date: Date.now(), event: 'captured', user: currentUser.name }]
        }).select().single();

        if (savedT) {
          const analysis = await getTerritoryAnalysis(savedT, centroid);
          if (analysis) await supabase.from('territories').update({ name: analysis.newName, strategy: analysis.strategy }).eq('id', savedT.id);
        }
      }
    }

    const missionXP = missions.filter(m => m.completed).reduce((acc, m) => acc + m.xpReward, 0);
    const nextXP = currentUser.xp + xpGain + captureBonus + missionXP;
    const xpToNext = currentUser.level * 1000;
    let newLevel = currentUser.level;
    let finalXP = nextXP;

    if (finalXP >= xpToNext) {
      finalXP -= xpToNext;
      newLevel += 1;
      setLastNotification(`NÍVEL ${newLevel}: OPERAÇÃO EVOLUÍDA!`);
    }

    await supabase.from('profiles').update({ 
      total_distance: currentUser.totalDistance + distKm,
      xp: finalXP,
      level: newLevel
    }).eq('id', currentUser.id);

    setCurrentUser(prev => prev ? ({ ...prev, totalDistance: prev.totalDistance + distKm, xp: finalXP, level: newLevel, rankTitle: getRankTitle(newLevel) }) : null);
    setCurrentPath([]);
  };

  if (isInitializing) {
    return (
      <div className="h-screen bg-[#020617] flex flex-col items-center justify-center font-mono">
        <div className="relative">
          <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
          <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-20"></div>
        </div>
        <p className="text-blue-500 text-[10px] font-bold tracking-[0.5em] animate-pulse">SISTEMA CONQUEST RUN_V1.5</p>
        <div className="mt-4 w-48 h-1 bg-gray-900 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 animate-[loading_2s_ease-in-out_infinite]"></div>
        </div>
        <style>{`
          @keyframes loading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="h-screen bg-[#020617] relative flex items-center justify-center p-6 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
        <div className="absolute inset-0 bg-gradient-to-t from-blue-900/20 to-transparent pointer-events-none"></div>

        <div className="w-full max-w-sm z-10 flex flex-col">
          <div className="text-center mb-10 animate-in fade-in zoom-in duration-700">
            <div className="inline-flex p-4 rounded-3xl bg-blue-600 shadow-[0_0_40px_rgba(37,99,235,0.4)] mb-4 border border-blue-400/50">
              <Swords size={40} className="text-white drop-shadow-lg" />
            </div>
            <h1 className="text-4xl font-black italic tracking-tighter uppercase leading-none">
              CONQUEST<span className="text-blue-500">RUN</span>
            </h1>
            <div className="flex items-center justify-center space-x-2 mt-2">
              <div className="h-[1px] w-8 bg-blue-500/50"></div>
              <p className="text-[9px] text-blue-400 font-bold uppercase tracking-[0.4em]">Protocolo Tactical</p>
              <div className="h-[1px] w-8 bg-blue-500/50"></div>
            </div>
          </div>

          <div className="bg-gray-900/60 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 space-y-6 shadow-2xl animate-in slide-in-from-bottom-12 duration-500">
            <div className="flex bg-black/40 p-1.5 rounded-2xl">
              <button onClick={() => setIsRegistering(false)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center space-x-2 ${!isRegistering ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-gray-500 hover:text-gray-300'}`}>
                <Activity size={12} />
                <span>Entrar</span>
              </button>
              <button onClick={() => setIsRegistering(true)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center space-x-2 ${isRegistering ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-gray-500 hover:text-gray-300'}`}>
                <Shield size={12} />
                <span>Alistar</span>
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5 group">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[9px] font-black uppercase text-gray-500 group-focus-within:text-blue-400 transition-colors">E-mail</label>
                  <Terminal size={10} className="text-gray-700 group-focus-within:text-blue-400" />
                </div>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-500" size={14} />
                  <input type="email" value={tempEmail} onChange={e=>setTempEmail(e.target.value)} placeholder="seu@email.com" className="w-full bg-black/40 border border-white/5 rounded-2xl pl-11 pr-4 py-4 text-xs font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-gray-700" />
                </div>
              </div>

              <div className="space-y-1.5 group">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[9px] font-black uppercase text-gray-500 group-focus-within:text-blue-400 transition-colors">Senha</label>
                  <Lock size={10} className="text-gray-700 group-focus-within:text-blue-400" />
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-500" size={14} />
                  <input type="password" value={tempPassword} onChange={e=>setTempPassword(e.target.value)} placeholder="••••••••" className="w-full bg-black/40 border border-white/5 rounded-2xl pl-11 pr-4 py-4 text-xs font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-gray-700" />
                </div>
              </div>

              {isRegistering && (
                <div className="space-y-1.5 animate-in slide-in-from-top-4 duration-300 group">
                  <label className="text-[9px] font-black uppercase text-gray-500 ml-1 group-focus-within:text-blue-400">Codename Tático</label>
                  <input type="text" value={tempName} onChange={e=>setTempName(e.target.value)} placeholder="NOME_DE_GUERRA" className="w-full bg-black/40 border border-white/5 rounded-2xl px-4 py-4 text-xs font-mono focus:outline-none focus:border-blue-500 transition-all placeholder:text-gray-700 uppercase" />
                </div>
              )}
            </div>

            <button onClick={handleAuth} disabled={isLoading} className="w-full py-5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-2xl font-black uppercase tracking-[0.2em] text-[12px] transition-all shadow-xl shadow-blue-900/30 flex items-center justify-center space-x-3 active:scale-95">
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : (
                <>
                  <span>{isRegistering ? 'Confirmar Alistamento' : 'Entrar'}</span>
                  {!isRegistering && <Activity size={16} className="animate-pulse" />}
                </>
              )}
            </button>

            {lastNotification && (
              <div className="bg-blue-900/20 border border-blue-500/20 p-3 rounded-xl">
                <p className="text-[9px] text-center font-bold text-blue-300 leading-tight uppercase">{lastNotification}</p>
              </div>
            )}
          </div>
          <p className="mt-8 text-[9px] text-center text-gray-700 font-black uppercase tracking-[0.5em]">Global Control v1.5 // Secure_Connection</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#020617] text-white overflow-hidden select-none font-sans">
      <Sidebar 
        currentUser={currentUser} 
        territories={territories} 
        leaderboard={leaderboard.slice(0, 5)} 
        aiAdvice={aiAdvice} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        onLogout={handleLogout}
        missions={missions}
      />
      
      <main className="flex-1 relative flex flex-col">
        <div className="absolute top-4 left-4 z-40">
          <button onClick={() => setIsSidebarOpen(true)} className="w-11 h-11 bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl flex items-center justify-center hover:bg-black/80 transition-all shadow-xl">
            <Menu size={20} />
          </button>
        </div>

        <GameMap 
          currentPath={currentPath} 
          territories={territories} 
          center={mapCenter} 
          zoom={mapZoom}
          onTerritoryClick={setSelectedTerritory} 
          isRecording={isRecording}
          onViewChange={(c, z) => {
            setMapCenter(c);
            setMapZoom(z);
            localStorage.setItem('conquest_run_map_center', JSON.stringify(c));
            localStorage.setItem('conquest_run_map_zoom', z.toString());
          }}
        />

        {/* Notificações Táticas */}
        <div className="absolute top-16 left-0 right-0 z-40 flex justify-center pointer-events-none px-6">
          {lastNotification && (
            <div className="bg-blue-600 px-6 py-4 rounded-2xl shadow-[0_0_30px_rgba(37,99,235,0.4)] border border-white/20 animate-in slide-in-from-top-10 flex items-center space-x-4">
              <Award size={20} className="text-yellow-400 animate-bounce" />
              <span className="text-[11px] font-black uppercase tracking-widest">{lastNotification}</span>
            </div>
          )}
        </div>

        {/* HUD Inferior */}
        <div className="absolute bottom-8 left-0 right-0 z-40 px-6">
          <div className="flex items-end justify-center space-x-8">
            <div className="flex flex-col items-center space-y-2">
              <button onClick={() => setIsRankingOpen(true)} className="w-14 h-14 bg-gray-900/90 border border-white/10 rounded-[1.25rem] flex items-center justify-center text-gray-400 hover:text-white transition-all shadow-2xl active:scale-90">
                <Trophy size={24}/>
              </button>
              <span className="text-[8px] font-black uppercase tracking-widest text-gray-600">Ranking</span>
            </div>

            <div className="flex flex-col items-center space-y-3">
              {!isRecording ? (
                <button onClick={() => setIsRecording(true)} className="bg-blue-600 w-24 h-24 rounded-[2rem] shadow-[0_0_50px_rgba(37,99,235,0.3)] flex items-center justify-center active:scale-95 transition-all group border-4 border-white/10">
                  <Play size={40} fill="currentColor" className="ml-1 text-white group-hover:scale-110 transition-transform" />
                </button>
              ) : (
                <button onClick={handleStop} className="bg-red-600 w-24 h-24 rounded-[2rem] shadow-[0_0_50px_rgba(220,38,38,0.3)] flex items-center justify-center animate-pulse active:scale-95 transition-all border-4 border-white/10">
                  <Square size={36} fill="currentColor" className="text-white" />
                </button>
              )}
              <span className={`text-[10px] font-black uppercase tracking-[0.4em] ${isRecording ? 'text-red-500' : 'text-blue-500'}`}>
                {isRecording ? 'Mapeando' : 'Patrulhar'}
              </span>
            </div>

            <div className="flex flex-col items-center space-y-2">
              <button onClick={() => setIsRankingOpen(false)} className="w-14 h-14 bg-gray-900/90 border border-white/10 rounded-[1.25rem] flex items-center justify-center text-gray-400 hover:text-white transition-all shadow-2xl active:scale-90">
                <Target size={24}/>
              </button>
              <span className="text-[8px] font-black uppercase tracking-widest text-gray-600">Missões</span>
            </div>
          </div>
        </div>
      </main>

      {/* Outras modais e rankings */}
      {selectedTerritory && (
        <div className="absolute inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-md px-4 pb-12" onClick={() => setSelectedTerritory(null)}>
          <div className="bg-gray-950 border border-white/10 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom-10 flex flex-col max-h-[85vh]" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tight">{selectedTerritory.name}</h2>
                <p className="text-blue-500 text-[10px] uppercase font-black tracking-widest mt-1">Domínio de: {selectedTerritory.ownerName}</p>
              </div>
              <button onClick={() => setSelectedTerritory(null)} className="p-2.5 bg-white/5 rounded-2xl"><X size={20}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-8 custom-scrollbar pr-2">
               <section className="bg-blue-600/10 border border-blue-500/20 p-5 rounded-3xl italic relative">
                 <div className="absolute top-2 right-4 text-[7px] font-black text-blue-500 uppercase tracking-widest">IA Intelligence</div>
                 <p className="text-[11px] text-blue-200 leading-relaxed">"{selectedTerritory.strategy || 'Protocolo de defesa padrão ativo.'}"</p>
               </section>

               <section>
                 <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center space-x-3">
                   <Clock size={12} className="text-yellow-500" />
                   <span>Log de Atividades</span>
                 </h3>
                 <div className="space-y-3">
                   {selectedTerritory.history.slice().reverse().map((h, i) => (
                     <div key={i} className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5">
                        <div className="flex items-center space-x-4">
                          <div className={`p-2 rounded-lg ${h.event === 'captured' ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>
                            {h.event === 'captured' ? <Swords size={16}/> : <Shield size={16}/>}
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase leading-none">{h.event === 'captured' ? 'Conquista' : 'Defesa'}</p>
                            <p className="text-[9px] text-gray-500 mt-1">{h.user}</p>
                          </div>
                        </div>
                        <p className="text-[9px] font-mono text-gray-600">{new Date(h.date).toLocaleDateString()}</p>
                     </div>
                   ))}
                 </div>
               </section>
            </div>
          </div>
        </div>
      )}

      {isRankingOpen && (
        <div className="absolute inset-0 z-[110] bg-[#020617] animate-in slide-in-from-right duration-400 flex flex-col">
          <div className="p-8 flex items-center justify-between border-b border-white/5 bg-black/50 backdrop-blur-md">
             <h2 className="text-2xl font-black uppercase tracking-tighter italic">TOP <span className="text-blue-500">OPERADORES</span></h2>
             <button onClick={() => setIsRankingOpen(false)} className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center shadow-xl"><X size={24}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
             {leaderboard.map((u, i) => (
               <div key={u.id} className={`p-5 rounded-3xl border transition-all hover:translate-x-2 ${u.id === currentUser.id ? 'bg-blue-600/20 border-blue-500/50 ring-1 ring-blue-500/30' : 'bg-gray-900/40 border-white/5'} flex items-center justify-between`}>
                 <div className="flex items-center space-x-5">
                   <span className="text-sm font-mono opacity-30 font-black">#{i+1}</span>
                   <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black shadow-inner border border-white/10 text-lg" style={{backgroundColor: u.color}}>{u.name[0]}</div>
                   <div>
                     <p className="text-sm font-black uppercase leading-none">{u.name}</p>
                     <p className="text-[9px] text-blue-400 font-black uppercase tracking-[0.2em] mt-1">{u.rankTitle}</p>
                   </div>
                 </div>
                 <div className="text-right">
                   <p className="text-base font-black text-white">{u.totalDistance.toFixed(1)}</p>
                   <p className="text-[9px] text-gray-600 uppercase font-black">KM TOTAL</p>
                 </div>
               </div>
             ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
