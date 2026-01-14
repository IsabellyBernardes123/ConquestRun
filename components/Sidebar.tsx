
import React from 'react';
import { User, Territory } from '../types';
import { MOCK_USERS } from '../constants';
import { Trophy, Shield, Map as MapIcon, Zap, X } from 'lucide-react';

interface SidebarProps {
  currentUser: User;
  territories: Territory[];
  aiAdvice: string;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentUser, territories, aiAdvice, isOpen, onClose }) => {
  const userTerritories = territories.filter(t => t.ownerId === currentUser.id);

  return (
    <>
      {/* Mobile Backdrop - Glass effect */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] lg:hidden animate-in fade-in duration-300" 
          onClick={onClose}
        />
      )}
      
      <div className={`
        fixed inset-y-0 left-0 z-[70] w-full sm:w-85 lg:w-80 bg-[#0a0f18] border-r border-gray-800/50 flex flex-col transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1)
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:flex
      `}>
        {/* Header with Close Button */}
        <div className="p-6 pb-0 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-2xl font-black shadow-[0_0_30px_rgba(37,99,235,0.3)] border border-white/10">
              {currentUser.name[0]}
            </div>
            <div>
              <h2 className="font-black text-xl tracking-tight">{currentUser.name}</h2>
              <p className="text-blue-400 text-[10px] font-bold uppercase tracking-[0.2em]">Nível {currentUser.level} Imperador</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="lg:hidden w-10 h-10 flex items-center justify-center bg-gray-800/50 rounded-xl text-gray-400 active:scale-90 transition-transform"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#111827] p-5 rounded-[2rem] border border-white/5 shadow-inner">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
                <MapIcon size={18} className="text-blue-500" />
              </div>
              <p className="text-3xl font-black">{userTerritories.length}</p>
              <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mt-1">Territórios</p>
            </div>
            <div className="bg-[#111827] p-5 rounded-[2rem] border border-white/5 shadow-inner">
              <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center mb-3">
                <Zap size={18} className="text-yellow-500" />
              </div>
              <p className="text-3xl font-black">{currentUser.totalDistance.toFixed(1)}</p>
              <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mt-1">KM Total</p>
            </div>
          </div>

          {/* AI Strategy Box */}
          <section>
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-4 pl-1">Inteligência do General</h3>
            <div className="bg-gradient-to-br from-blue-900/20 to-transparent border border-blue-800/30 p-6 rounded-[2.5rem] relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Shield size={64} />
              </div>
              <p className="text-sm text-blue-100 leading-relaxed italic relative z-10">
                "{aiAdvice || 'Calculando probabilidade de conquista para o próximo setor...'}"
              </p>
            </div>
          </section>

          {/* Leaderboard */}
          <section>
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-4 pl-1">Ranking Global</h3>
            <div className="space-y-3">
              {MOCK_USERS.sort((a, b) => b.totalDistance - a.totalDistance).map((user, idx) => (
                <div key={user.id} className={`flex items-center justify-between p-4 rounded-2xl transition-all border ${user.id === currentUser.id ? 'bg-blue-600/10 border-blue-500/30' : 'bg-gray-800/20 border-transparent hover:border-gray-700/50'}`}>
                  <div className="flex items-center space-x-4">
                    <span className={`text-xs font-mono w-4 font-bold ${idx === 0 ? 'text-yellow-500' : 'text-gray-600'}`}>0{idx + 1}</span>
                    <div className="relative">
                      <div className="w-10 h-10 rounded-xl border-2 flex items-center justify-center text-xs font-black bg-gray-900" style={{ borderColor: user.color }}>
                        {user.name[0]}
                      </div>
                      {idx === 0 && (
                        <div className="absolute -top-1 -right-1 bg-yellow-500 rounded-full p-0.5 border-2 border-[#0a0f18]">
                           <Trophy size={10} className="text-black" />
                        </div>
                      )}
                    </div>
                    <div>
                       <span className="text-sm font-bold block">{user.name}</span>
                       <span className="text-[10px] text-gray-500 uppercase font-black tracking-tighter">{user.totalDistance.toFixed(1)} KM</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="p-8 border-t border-gray-800/50 bg-[#0a0f18]/80 backdrop-blur-md">
          <div className="flex items-center justify-center space-x-3 text-gray-500 text-[10px] font-black uppercase tracking-[0.3em]">
            <Shield size={14} className="text-blue-500" />
            <span>Operação ConquestRun v1.0</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
