
import React, { useState, useEffect } from 'react';
import GameMap from './components/GameMap';
import Sidebar from './components/Sidebar';
import { Coordinate, Territory, User } from './types';
import { MOCK_USERS, INITIAL_TERRITORIES, MAP_CONFIG } from './constants';
import { 
  Play, Square, MapPin, ShieldCheck, X, Activity, Swords, 
  Clock, ExternalLink, Menu, User as UserIcon, Navigation, 
  ChevronRight, Lock, Eye, EyeOff, Loader2, Mail 
} from 'lucide-react';
import { getTrainingAdvice, getTerritoryAnalysis } from './services/geminiService';
import { supabase } from './lib/supabase';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [currentPath, setCurrentPath] = useState<Coordinate[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null);
  const [aiAdvice, setAiAdvice] = useState("");
  const [lastNotification, setLastNotification] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<Coordinate>(MAP_CONFIG.initialCenter);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Auth states
  const [isRegistering, setIsRegistering] = useState(false);
  const [tempEmail, setTempEmail] = useState("");
  const [tempName, setTempName] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [tempColor, setTempColor] = useState("#3b82f6");
  const [showPassword, setShowPassword] = useState(false);

  const colors = [
    { name: 'Azul Neon', value: '#3b82f6' },
    { name: 'Esmeralda', value: '#10b981' },
    { name: 'Vibrant Pink', value: '#ec4899' },
    { name: 'Amber Glow', value: '#f59e0b' },
    { name: 'Ciber Violet', value: '#8b5cf6' },
  ];

  // Check existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        fetchUserProfile(session.user.id);
      }
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setCurrentUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

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

  // Load Territories from Supabase
  useEffect(() => {
    const fetchTerritories = async () => {
      const { data, error } = await supabase
        .from('territories')
        .select(`*, profiles(username)`);
      
      if (data) {
        const formatted = data.map(t => ({
          ...t,
          ownerName: t.profiles?.username || 'Operador Desconhecido',
          history: t.history || []
        }));
        setTerritories(formatted);
      }
    };

    fetchTerritories();
  }, [currentUser]);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        const newCenter = { lat: position.coords.latitude, lng: position.coords.longitude };
        setMapCenter(newCenter);
      });
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      const loadAdvice = async () => {
        const advice = await getTrainingAdvice(currentUser.totalDistance, territories.filter(t => t.ownerId === currentUser.id).length);
        setAiAdvice(advice);
      };
      loadAdvice();
    }
  }, [currentUser, territories.length]);

  const handleAuth = async () => {
    if (!tempEmail.includes("@") || tempPassword.length < 6) {
      setLastNotification("E-mail inválido ou senha muito curta (mín. 6).");
      return;
    }
    
    if (isRegistering && tempName.trim().length < 3) {
      setLastNotification("O Codename precisa de pelo menos 3 caracteres.");
      return;
    }

    setIsLoading(true);

    if (isRegistering) {
      // Sign Up Flow
      const { data, error } = await supabase.auth.signUp({
        email: tempEmail,
        password: tempPassword,
        options: {
          data: {
            username: tempName,
            color: tempColor,
          }
        }
      });

      if (error) {
        setLastNotification(`Erro no cadastro: ${error.message}`);
      } else if (data.user) {
        setLastNotification("Conta criada com sucesso!");
        // O trigger handle_new_user() no Postgres criará o profile
      }
    } else {
      // Sign In Flow
      const { data, error } = await supabase.auth.signInWithPassword({
        email: tempEmail,
        password: tempPassword,
      });

      if (error) {
        setLastNotification(`Erro no login: ${error.message}`);
      }
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
    const start = path[0];
    const end = path[path.length - 1];
    const dist = Math.sqrt(Math.pow(start.lat - end.lat, 2) + Math.pow(start.lng - end.lng, 2));
    return dist < 0.00025;
  };

  const handleStop = async () => {
    if (!currentUser) return;
    setIsRecording(false);
    const isClosed = checkClosedLoop(currentPath);
    const distance = calculateDistance(currentPath);

    if (isClosed && currentPath.length > 5) {
      setLastNotification("Processando ocupação de setor...");
      
      const lats = currentPath.map(p => p.lat);
      const lngs = currentPath.map(p => p.lng);
      const centroid = {
        lat: lats.reduce((a, b) => a + b, 0) / lats.length,
        lng: lngs.reduce((a, b) => a + b, 0) / lngs.length
      };

      const newTerritoryData = {
        owner_id: currentUser.id,
        points: currentPath,
        area: distance * 10,
        perimeter: distance,
        color: currentUser.color,
        name: `Setor em Análise`
      };

      const { data: savedT, error } = await supabase
        .from('territories')
        .insert(newTerritoryData)
        .select()
        .single();

      if (savedT) {
        const analysis = await getTerritoryAnalysis(savedT, centroid);
        if (analysis) {
          await supabase
            .from('territories')
            .update({ 
              name: analysis.newName, 
              strategy: analysis.strategy, 
              sources: analysis.sources 
            })
            .eq('id', savedT.id);
          
          setTerritories(prev => [...prev, {
            ...savedT,
            ownerName: currentUser.name,
            name: analysis.newName,
            strategy: analysis.strategy,
            sources: analysis.sources,
            history: []
          }]);
          setLastNotification(`Domínio Confirmado: ${analysis.newName}`);
        }
      }
    } else {
      setLastNotification("Falha tática: Perímetro Incompleto");
    }

    const newTotalDist = currentUser.totalDistance + (distance / 1000);
    await supabase
      .from('profiles')
      .update({ total_distance: newTotalDist })
      .eq('id', currentUser.id);

    setCurrentUser(prev => prev ? ({
      ...prev,
      totalDistance: newTotalDist,
      xp: prev.xp + Math.floor(distance / 10)
    }) : null);
    
    setCurrentPath([]);
    setTimeout(() => setLastNotification(null), 4000);
  };

  if (!currentUser) {
    return (
      <div className="h-screen bg-[#0a0f18] flex flex-col items-center justify-end overflow-hidden relative font-sans">
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(circle_at_50%_20%,_rgba(59,130,246,0.15),_transparent_70%)]" />
          <div className="absolute top-[20%] right-[-10%] w-64 h-64 bg-blue-600/10 blur-[120px] rounded-full animate-pulse" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center space-y-4 px-6 relative z-10 animate-in fade-in duration-1000">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-400 rounded-[2rem] flex items-center justify-center shadow-2xl transform -rotate-3 transition-transform hover:rotate-0">
            <Swords size={40} className="text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-5xl font-black tracking-tighter text-white uppercase italic leading-none">
              CONQUEST<span className="text-blue-500">RUN</span>
            </h1>
            <p className="mt-2 text-blue-400/60 font-black uppercase tracking-[0.4em] text-[9px]">Global Territory Protocol</p>
          </div>
        </div>

        <div className="w-full max-w-xl bg-gray-950/80 backdrop-blur-3xl border-t border-white/10 rounded-t-[3rem] p-8 lg:p-12 shadow-[0_-20px_80px_rgba(0,0,0,0.8)] relative z-20 flex flex-col space-y-8 animate-in slide-in-from-bottom duration-700">
          <div className="space-y-6">
            <div className="flex items-center justify-center space-x-1 p-1 bg-gray-900/50 rounded-2xl w-full">
              <button 
                onClick={() => setIsRegistering(false)}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!isRegistering ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Login
              </button>
              <button 
                onClick={() => setIsRegistering(true)}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isRegistering ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Cadastro
              </button>
            </div>

            <div className="space-y-4">
              {/* E-mail Input */}
              <div className="relative group">
                <Mail size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-500 transition-colors" />
                <input 
                  type="email" 
                  value={tempEmail}
                  onChange={(e) => setTempEmail(e.target.value)}
                  placeholder="E-mail"
                  disabled={isLoading}
                  className="w-full bg-gray-900/50 border border-white/5 rounded-[1.5rem] pl-14 pr-6 py-4 text-base text-white focus:outline-none focus:border-blue-500/30 transition-all placeholder:text-gray-700"
                />
              </div>

              {/* Password Input */}
              <div className="relative group">
                <Lock size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-500 transition-colors" />
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  placeholder="Senha"
                  disabled={isLoading}
                  className="w-full bg-gray-900/50 border border-white/5 rounded-[1.5rem] pl-14 pr-16 py-4 text-base text-white focus:outline-none focus:border-blue-500/30 transition-all placeholder:text-gray-700"
                />
                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white transition-colors">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Codename Input - Only for Register */}
              {isRegistering && (
                <div className="relative group animate-in slide-in-from-top-4 duration-300">
                  <UserIcon size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    type="text" 
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    placeholder="Seu Codename (ex: RunnerNinja)"
                    disabled={isLoading}
                    className="w-full bg-gray-900/50 border border-white/5 rounded-[1.5rem] pl-14 pr-6 py-4 text-base text-white focus:outline-none focus:border-blue-500/30 transition-all placeholder:text-gray-700"
                  />
                </div>
              )}
            </div>

            {/* Color Selection - Only for Register */}
            {isRegistering && (
              <div className="space-y-4 pt-2 animate-in fade-in duration-500">
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] text-center block">Assinatura Visual de Domínio</label>
                <div className="flex justify-between max-w-sm mx-auto">
                  {colors.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setTempColor(c.value)}
                      disabled={isLoading}
                      className={`w-12 h-12 rounded-xl transition-all relative ${tempColor === c.value ? 'scale-110 border-2 border-white' : 'opacity-20 hover:opacity-100'}`}
                      style={{ backgroundColor: c.value, boxShadow: tempColor === c.value ? `0 0 20px ${c.value}aa` : 'none' }}
                    >
                      {tempColor === c.value && <ShieldCheck size={20} className="absolute inset-0 m-auto text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <button 
              onClick={handleAuth}
              disabled={isLoading || tempEmail.length < 5}
              className="w-full py-5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 rounded-[1.5rem] text-white font-black uppercase tracking-[0.4em] transition-all flex items-center justify-center space-x-4 shadow-xl active:scale-[0.98]"
            >
              {isLoading ? <Loader2 size={24} className="animate-spin" /> : <span>{isRegistering ? 'Criar Operador' : 'Autenticar'}</span>}
              {!isLoading && <ChevronRight size={18} />}
            </button>
            
            <p className="text-center text-[9px] text-gray-700 uppercase font-black tracking-widest pb-4">
              Operação ConquestRun • Encriptação de Ponta a Ponta
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0a0f18] text-white overflow-hidden font-sans select-none">
      <Sidebar 
        currentUser={currentUser} 
        territories={territories} 
        aiAdvice={aiAdvice} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
      />
      
      <main className="flex-1 relative overflow-hidden flex flex-col">
        {/* Top Header */}
        <div className="absolute top-0 inset-x-0 p-4 z-40 flex items-center justify-between pointer-events-none">
          <button onClick={() => setIsSidebarOpen(true)} className="w-12 h-12 bg-gray-950/80 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center justify-center pointer-events-auto transition-transform active:scale-90">
            <Menu size={22} />
          </button>
          <div className="bg-gray-950/80 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-2xl flex items-center space-x-3 pointer-events-auto">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.8)]"></div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">{currentUser.name.toUpperCase()}</span>
          </div>
        </div>

        <div className="flex-1 relative">
          <GameMap 
            currentPath={currentPath} 
            territories={territories} 
            center={currentPath.length > 0 ? currentPath[currentPath.length - 1] : mapCenter} 
            onTerritoryClick={setSelectedTerritory}
          />
        </div>

        {/* Territory Detail Modal */}
        {selectedTerritory && (
          <div className="absolute inset-0 z-[100] flex items-end lg:items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="absolute inset-0" onClick={() => setSelectedTerritory(null)} />
            <div className="relative bg-[#0a0f18] border-t border-gray-800 lg:border lg:border-white/10 w-full max-w-2xl rounded-t-[3rem] lg:rounded-[3rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-500">
              <div className="lg:hidden w-16 h-1.5 bg-gray-800 rounded-full mx-auto mt-6 mb-2" />
              <div className="relative h-32 flex items-end p-8 lg:p-10 overflow-hidden">
                <div className="absolute inset-0 opacity-20" style={{ backgroundColor: selectedTerritory.color }} />
                <button onClick={() => setSelectedTerritory(null)} className="absolute top-6 right-8 p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-colors">
                  <X size={20} />
                </button>
                <div className="flex items-center space-x-6 relative z-10">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-2xl transform rotate-3" style={{ backgroundColor: selectedTerritory.color }}>
                    <Swords size={32} />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-white leading-none mb-1">{selectedTerritory.name}</h2>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Operador: {selectedTerritory.ownerName}</p>
                  </div>
                </div>
              </div>
              <div className="p-8 lg:p-10 space-y-10 max-h-[75vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-800/20 p-5 rounded-[2rem] border border-white/5 text-center">
                    <Activity size={20} className="text-blue-400 mx-auto mb-3" />
                    <p className="text-2xl font-black">{(selectedTerritory.area / 1000).toFixed(1)}</p>
                    <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest">km²</p>
                  </div>
                  <div className="bg-gray-800/20 p-5 rounded-[2rem] border border-white/5 text-center">
                    <ShieldCheck size={20} className="text-green-400 mx-auto mb-3" />
                    <p className="text-2xl font-black">{selectedTerritory.defenses || 0}</p>
                    <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Defesas</p>
                  </div>
                  <div className="bg-gray-800/20 p-5 rounded-[2rem] border border-white/5 text-center">
                    <Clock size={20} className="text-purple-400 mx-auto mb-3" />
                    <p className="text-2xl font-black">{Math.floor((Date.now() - new Date(selectedTerritory.capturedAt).getTime()) / 3600000)}h</p>
                    <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Tempo</p>
                  </div>
                </div>
                <section>
                  <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-4">Relatório Estratégico</h3>
                  <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-[2.5rem] text-sm text-blue-100 leading-relaxed italic border-l-4 border-l-blue-500">
                    {selectedTerritory.strategy || 'Analistas estão processando dados deste setor...'}
                  </div>
                </section>
              </div>
              <div className="p-8 bg-[#0a0f18] border-t border-gray-800">
                <button onClick={() => setSelectedTerritory(null)} className="w-full py-5 bg-gray-800 rounded-2xl text-[11px] font-black uppercase tracking-[0.4em] active:scale-[0.98] transition-transform">Sair do Relatório</button>
              </div>
            </div>
          </div>
        )}

        {/* Notifications HUD */}
        <div className="absolute top-24 left-0 right-0 z-[45] flex justify-center px-6 pointer-events-none">
          {lastNotification && (
            <div className="bg-blue-600/90 backdrop-blur-2xl text-white px-8 py-5 rounded-[2rem] shadow-2xl flex items-center space-x-5 animate-in slide-in-from-top-10 duration-500 pointer-events-auto border border-white/10">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <ShieldCheck size={20} />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60">Status da Missão</p>
                <span className="text-sm font-black uppercase tracking-wider">{lastNotification}</span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom HUD */}
        <div className="p-6 pt-0 z-40 space-y-4">
          {isRecording && (
            <div className="bg-gray-950/90 backdrop-blur-3xl border border-white/10 p-6 rounded-[2.5rem] shadow-2xl flex justify-around items-center w-full max-w-lg mx-auto animate-in slide-in-from-bottom-20 duration-500">
              <div className="flex-1 text-center border-r border-white/5">
                <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">Distância</p>
                <p className="text-3xl font-black text-blue-400 tracking-tighter">{(calculateDistance(currentPath) / 1000).toFixed(2)} <span className="text-[10px] uppercase">km</span></p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">Perímetro</p>
                <div className={`text-xs font-black flex items-center justify-center space-x-2 ${checkClosedLoop(currentPath) ? 'text-green-400' : 'text-yellow-400'}`}>
                  {checkClosedLoop(currentPath) ? <><ShieldCheck size={16} /> <span className="tracking-widest uppercase">FECHADO</span></> : <><Navigation size={16} className="animate-pulse" /> <span className="tracking-widest uppercase">MAPEANDO</span></>}
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center justify-center space-x-5 w-full max-w-lg mx-auto">
            <button className="w-16 h-16 bg-gray-950/80 backdrop-blur-2xl border border-white/10 rounded-[1.75rem] flex items-center justify-center text-gray-400 hover:text-white shadow-2xl active:scale-90 group transition-all">
              <MapPin size={24} />
            </button>
            {!isRecording ? (
              <button onClick={() => setIsRecording(true)} className="bg-blue-600 hover:bg-blue-500 text-white w-28 h-28 rounded-[2.5rem] shadow-[0_0_60px_rgba(37,99,235,0.6)] transition-all flex items-center justify-center hover:scale-105 active:scale-90 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <Play size={44} fill="currentColor" className="ml-2 relative z-10" />
              </button>
            ) : (
              <button onClick={handleStop} className="bg-red-600 hover:bg-red-500 text-white w-28 h-28 rounded-[2.5rem] shadow-[0_0_60px_rgba(220,38,38,0.6)] transition-all flex items-center justify-center hover:scale-105 active:scale-90 group">
                <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <Square size={36} fill="currentColor" className="relative z-10" />
              </button>
            )}
            <button onClick={() => setIsSidebarOpen(true)} className="w-16 h-16 bg-gray-950/80 backdrop-blur-2xl border border-white/10 rounded-[1.75rem] flex items-center justify-center text-gray-400 hover:text-white active:scale-90 group transition-all">
              <UserIcon size={24} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
