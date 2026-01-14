
import React from 'react';
import { User, Territory } from '../types';
import { Trophy, Shield, Map as MapIcon, Zap, X, Star } from 'lucide-react';

interface SidebarProps {
  currentUser: User;
  territories: Territory[];
  leaderboard: User[];
  aiAdvice: string;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentUser, territories, leaderboard, aiAdvice, isOpen, onClose }) => {
  const userTerritories = territories.filter(t => t.ownerId === currentUser.id);
  const xpToNext = currentUser.level * 1000;
  const xpProgress = (currentUser.xp / xpToNext) * 100;

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden" onClick={onClose} />
      )}
      
      <div className={`
        fixed inset-y-0 left-0 z-[70] w-72 bg-[#0a0f18] border-r border-white/5 flex flex-col transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:flex
      `}>
        <div className="p-5 flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-black shadow-lg" style={{ backgroundColor: currentUser.color }}>
                {currentUser.name[0]}
              </div>
              <div>
                <h2 className="font-black text-sm uppercase tracking-tight">{currentUser.name}</h2>
                <div className="flex items-center space-x-1.5">
                   <Star size={10} className="text-blue-400 fill-blue-400" />
                   <p className="text-blue-500 text-[8px] font-black uppercase tracking-widest">Nível {currentUser.level}</p>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="lg:hidden text-gray-500"><X size={18} /></button>
          </div>

          {/* XP Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center px-0.5">
              <span className="text-[7px] font-black text-gray-500 uppercase tracking-widest">Progresso Tático</span>
              <span className="text-[7px] font-black text-blue-400 uppercase tracking-widest">{currentUser.xp} / {xpToNext} XP</span>
            </div>
            <div className="h-1.5 w-full bg-gray-900 rounded-full overflow-hidden border border-white/5">
              <div 
                className="h-full bg-gradient-to-r from-blue-600 to-blue-400 shadow-[0_0_8px_rgba(37,99,235,0.5)] transition-all duration-1000"
                style={{ width: `${xpProgress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="p-5 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-900/50 p-4 rounded-xl border border-white/5 group hover:border-blue-500/30 transition-all">
              <MapIcon size={14} className="text-blue-500 mb-2" />
              <p className="text-xl font-black">{userTerritories.length}</p>
              <p className="text-[8px] text-gray-500 uppercase font-black tracking-widest">Setores</p>
            </div>
            <div className="bg-gray-900/50 p-4 rounded-xl border border-white/5 group hover:border-yellow-500/30 transition-all">
              <Zap size={14} className="text-yellow-500 mb-2" />
              <p className="text-xl font-black">{currentUser.totalDistance.toFixed(1)}</p>
              <p className="text-[8px] text-gray-500 uppercase font-black tracking-widest">KM</p>
            </div>
          </div>

          <section>
            <h3 className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-3">Inteligência do General</h3>
            <div className="bg-blue-950/20 border border-blue-900/30 p-4 rounded-xl">
              <p className="text-[10px] text-blue-100 leading-relaxed italic">
                "{aiAdvice || 'Sincronizando com o satélite...'}"
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-3">Ranking de Operadores</h3>
            <div className="space-y-2">
              {leaderboard.map((user, idx) => (
                <div key={user.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${user.id === currentUser.id ? 'bg-blue-600/10 border-blue-500/30' : 'bg-gray-900/30 border-transparent'}`}>
                  <div className="flex items-center space-x-3">
                    <span className="text-[10px] font-mono text-gray-600">0{idx + 1}</span>
                    <div className="w-8 h-8 rounded-md border flex items-center justify-center text-[10px] font-black" style={{ borderColor: user.color, backgroundColor: `${user.color}10` }}>
                      {user.name[0]}
                    </div>
                    <div>
                       <span className="text-xs font-bold block leading-none">{user.name}</span>
                       <span className="text-[8px] text-gray-500 font-black">{user.totalDistance.toFixed(1)} KM</span>
                    </div>
                  </div>
                  {idx === 0 && <Trophy size={12} className="text-yellow-500" />}
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="p-5 border-t border-white/5 flex items-center justify-center space-x-2 text-[8px] text-gray-600 font-black uppercase tracking-widest">
          <Shield size={10} />
          <span>Protocolo ConquestRun v1.1</span>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
