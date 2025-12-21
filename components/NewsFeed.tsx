
import React, { useState } from 'react';
import { Rocket, GitCommit, ShieldCheck, Zap, Bug, Calendar, Tag, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { RELEASES, Release } from '../data/releases';

const ReleaseNotes: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedVersions, setExpandedVersions] = useState<string[]>([RELEASES[0].version]); // Expand latest by default

  const toggleVersion = (v: string) => {
      setExpandedVersions(prev => 
          prev.includes(v) ? prev.filter(ver => ver !== v) : [...prev, v]
      );
  };

  const filteredReleases = RELEASES.filter(r => 
      r.version.includes(searchTerm) || 
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.changes.some(c => c.text.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getTypeColor = (type: string) => {
      switch(type) {
          case 'MAJOR': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800';
          case 'MINOR': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800';
          default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
      }
  };

  const getChangeIcon = (type: string) => {
      switch(type) {
          case 'NEW': return <Zap size={14} className="text-emerald-500" />;
          case 'FIX': return <Bug size={14} className="text-red-500" />;
          case 'SECURITY': return <ShieldCheck size={14} className="text-blue-500" />;
          case 'IMPROVE': return <Rocket size={14} className="text-amber-500" />;
          default: return <GitCommit size={14} className="text-gray-500" />;
      }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-gray-200 dark:border-slate-700 pb-6">
          <div>
              <h1 className="text-3xl font-black text-gray-800 dark:text-white flex items-center gap-3">
                  <Rocket className="text-indigo-600 dark:text-indigo-400" size={32}/> 
                  Release Notes
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">
                  Histórico de evolução e melhorias do Gestor360.
              </p>
          </div>
          
          <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-3 text-gray-400" size={18} />
              <input 
                  type="text" 
                  placeholder="Buscar versão ou recurso..." 
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
              />
          </div>
      </div>

      {/* Timeline */}
      <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent dark:before:via-slate-700">
          
          {filteredReleases.map((release, idx) => {
              const isExpanded = expandedVersions.includes(release.version);
              const isLatest = idx === 0;

              return (
                  <div key={release.version} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      
                      {/* Timeline Dot */}
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-xl z-10 ${isLatest ? 'bg-indigo-600 border-indigo-100 dark:border-indigo-900 text-white' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400'}`}>
                          {isLatest ? <Rocket size={18} className="animate-pulse" /> : <GitCommit size={18} />}
                      </div>
                      
                      {/* Content Card */}
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
                          
                          <div className="flex justify-between items-start mb-2 cursor-pointer" onClick={() => toggleVersion(release.version)}>
                              <div className="flex flex-col">
                                  <div className="flex items-center gap-2 mb-1">
                                      <span className={`text-xs font-bold px-2 py-0.5 rounded border ${getTypeColor(release.type)}`}>
                                          v{release.version}
                                      </span>
                                      {isLatest && <span className="text-[10px] font-bold bg-green-500 text-white px-2 py-0.5 rounded-full animate-pulse">LATEST</span>}
                                  </div>
                                  <h3 className="font-bold text-lg text-gray-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                      {release.title}
                                  </h3>
                              </div>
                              <button className="text-gray-400 hover:text-indigo-500">
                                  {isExpanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                              </button>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-4">
                              <Calendar size={12}/> {release.date}
                          </div>

                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
                              {release.description}
                          </p>

                          {/* Changes List */}
                          {isExpanded && (
                              <div className="bg-gray-50 dark:bg-slate-950/50 rounded-xl p-4 space-y-3 border border-gray-100 dark:border-slate-800 animate-in slide-in-from-top-2">
                                  {release.changes.map((change, i) => (
                                      <div key={i} className="flex gap-3 items-start text-sm">
                                          <div className="mt-0.5 shrink-0 p-1 bg-white dark:bg-slate-800 rounded shadow-sm border border-gray-100 dark:border-slate-700">
                                              {getChangeIcon(change.type)}
                                          </div>
                                          <span className="text-gray-700 dark:text-gray-300 leading-snug">
                                              <strong className="text-xs font-bold opacity-70 mr-1">[{change.type}]</strong>
                                              {change.text}
                                          </span>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  </div>
              );
          })}

          {filteredReleases.length === 0 && (
              <div className="text-center py-10 text-gray-500">
                  Nenhuma versão encontrada com este filtro.
              </div>
          )}
      </div>
    </div>
  );
};

export default ReleaseNotes;
