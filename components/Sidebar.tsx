
import React from 'react';
import { User, Territory, Mission } from '../types';
import { Trophy, Shield, Zap, X, Target, ChevronRight, LogOut, Settings } from 'lucide-react';

interface SidebarProps {
  currentUser: User;
  territories: Territory[];
  leaderboard: User[];
  aiAdvice: string;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  missions: Mission[];
}

const Sidebar: React.FC<SidebarProps> = ({ currentUser, territories, leaderboard, aiAdvice, isOpen, onClose, onLogout, missions }) => {
  const userTerritories = territories.filter(t => t.ownerId === currentUser.id);
  const xpToNext = currentUser.level * 1000;
  const xpProgress = (currentUser.xp / xpToNext) * 100;

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden" onClick={onClose} />}
      
      <div className={`fixed inset-y-0 left-0 z-[70] w-72 bg-[#0a0f18] border-r border-white/5 flex flex-col transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 lg:flex shadow-2xl`}>
        <div className="p-6 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
          {/* Perfil Tático */}
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black shadow-[0_0_20px_rgba(0,0,0,0.5)] border-2 border-white/10" style={{ backgroundColor: currentUser.color }}>
                {currentUser.name[0]}
              </div>
              <div className="flex-1">
                <h2 className="font-black text-sm uppercase tracking-tight">{currentUser.name}</h2>
                <p className="text-blue-500 text-[10px] font-black uppercase tracking-widest">{currentUser.rankTitle}</p>
              </div>
              <button onClick={onClose} className="lg:hidden text-gray-600 hover:text-white transition-colors"><X size={20} /></button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Nível {currentUser.level}</span>
                <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">{currentUser.xp} / {xpToNext} XP</span>
              </div>
              <div className="h-2.5 w-full bg-black rounded-full overflow-hidden border border-white/5 p-0.5">
                <div className="h-full bg-blue-600 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.6)] transition-all duration-1000" style={{ width: `${xpProgress}%` }} />
              </div>
            </div>
          </div>

          {/* Centro de Missões */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-widest flex items-center space-x-2">
                <Target size={12} className="text-red-500" />
                <span>Missões Operacionais</span>
              </h3>
            </div>
            <div className="space-y-3">
              {missions.length > 0 ? missions.map(mission => (
                <div key={mission.id} className={`p-4 rounded-2xl border transition-all ${mission.completed ? 'bg-green-500/10 border-green-500/30 ring-1 ring-green-500/10' : 'bg-gray-900/40 border-white/5'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <p className={`text-[11px] font-black uppercase leading-tight ${mission.completed ? 'text-green-400' : 'text-white'}`}>{mission.title}</p>
                    <span className="text-[9px] font-black text-yellow-500">+{mission.xpReward} XP</span>
                  </div>
                  <div className="flex justify-between text-[8px] text-gray-500 font-bold uppercase mb-2">
                    <span className="max-w-[70%]">{mission.description}</span>
                    <span className="font-mono">{Math.min(mission.current, mission.target).toFixed(1)}/{mission.target}</span>
                  </div>
                  <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-700 ${mission.completed ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-blue-500 shadow-[0_0_10px_rgba(37,99,235,0.5)]'}`} style={{ width: `${(mission.current / mission.target) * 100}%` }} />
                  </div>
                </div>
              )) : (
                <div className="text-center py-6 border-2 border-dashed border-white/5 rounded-2xl">
                  <p className="text-[10px] text-gray-700 font-black uppercase tracking-widest">Nenhuma missão ativa</p>
                </div>
              )}
            </div>
          </section>

          {/* Inteligência IA */}
          <section className="bg-blue-950/20 border border-blue-900/40 p-5 rounded-3xl relative overflow-hidden group">
            <div className="absolute -top-4 -right-4 w-12 h-12 bg-blue-500/10 rounded-full blur-xl group-hover:bg-blue-500/20 transition-all"></div>
            <h3 className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-3 flex items-center space-x-2">
              <Zap size={10} className="text-yellow-400" />
              <span>Doutrina IA</span>
            </h3>
            <p className="text-[11px] text-blue-100/80 leading-relaxed italic font-medium">
              "{aiAdvice || 'Calculando próxima rota estratégica...'}"
            </p>
          </section>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/5 bg-black/40 space-y-2">
          <button className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors text-gray-500 hover:text-white">
            <div className="flex items-center space-x-3">
              <Settings size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Ajustes</span>
            </div>
            <ChevronRight size={14} />
          </button>
          
          <button 
            onClick={onLogout}
            className="w-full flex items-center space-x-3 p-3 rounded-xl text-red-500/70 hover:text-red-500 hover:bg-red-500/10 transition-all group"
          >
            <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest">Abortar Missão</span>
          </button>

          <div className="pt-2 flex items-center justify-center space-x-2 text-[8px] text-gray-700 font-black uppercase tracking-[0.2em]">
            <Zap size={10} className="text-yellow-600" />
            <span>Tactical Core v1.5</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
