
import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, ResponsiveContainer, PieChart, Pie, Cell,
  AreaChart, Area
} from 'recharts';
import { 
  Download, TrendingUp, AlertCircle, Clock, 
  Users, Zap, Shield, Cloud, DollarSign, Target, Split
} from 'lucide-react';
import { WhatsAppManualLogger } from '../services/whatsappLogger';
import { CampaignStatistics } from '../types';

interface WhatsAppDashboardProps {
  campaignId?: string; 
  darkMode: boolean;
}

const WhatsAppDashboard: React.FC<WhatsAppDashboardProps> = ({ campaignId, darkMode }) => {
  const [stats, setStats] = useState<CampaignStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'OVERVIEW' | 'PERFORMANCE' | 'ERRORS'>('OVERVIEW');

  useEffect(() => {
    if (campaignId) loadStatistics();
  }, [campaignId]);

  const loadStatistics = async () => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const statistics = await WhatsAppManualLogger.generateCampaignStatistics(campaignId);
      setStats(statistics);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!campaignId) {
      return (
          <div className="p-10 text-center text-gray-500">
              Selecione uma campanha para ver o dashboard.
          </div>
      );
  }

  if (loading) return <div className="p-10 text-center">Carregando dados...</div>;
  if (!stats) return <div className="p-10 text-center">Sem dados disponíveis.</div>;

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  // Data prep
  const errorData = Object.entries(stats.errorAnalysis.byType)
    .map(([k,v]) => ({ name: k, value: v as number }))
    .filter(d => d.value > 0);
    
  const perfData = Object.entries(stats.performanceBySpeed).map(([k, v]: any) => ({ name: k, ...v }));
  
  return (
    <div className="space-y-6 p-4">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Dashboard da Campanha</h2>
          <p className="text-sm text-gray-500">Análise de performance e engajamento</p>
        </div>
      </div>

      {/* METRICS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard title="Total Contatos" value={stats.totalContacts} sub={`${stats.attempted} processados`} icon={<Users/>} color="blue" darkMode={darkMode} />
          <MetricCard title="Sucesso" value={((stats.completed / (stats.attempted || 1)) * 100).toFixed(1) + '%'} sub={`${stats.completed} envios`} icon={<TrendingUp/>} color="green" darkMode={darkMode} />
          <MetricCard title="Tempo Médio" value={stats.averageTimePerContact.toFixed(1) + 's'} sub="por contato" icon={<Clock/>} color="purple" darkMode={darkMode} />
          <MetricCard title="Erros" value={stats.failed} sub={`${stats.errorAnalysis.errorRate.toFixed(1)}% taxa`} icon={<AlertCircle/>} color="red" darkMode={darkMode} />
      </div>

      {/* ROI & REVENUE ROW */}
      {stats.financialImpact && (stats.financialImpact.revenue > 0 || stats.financialImpact.salesCount > 0) && (
          <div className={`p-6 rounded-xl border shadow-sm ${darkMode ? 'bg-gradient-to-br from-indigo-900/40 to-slate-900 border-indigo-500/30' : 'bg-gradient-to-br from-indigo-50 to-white border-indigo-100'}`}>
              <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${darkMode ? 'text-indigo-300' : 'text-indigo-800'}`}>
                  <DollarSign size={20} /> Impacto Financeiro (ROI)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                      <p className="text-xs uppercase font-bold opacity-60">Receita Gerada</p>
                      <p className="text-3xl font-bold text-emerald-500">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.financialImpact.revenue)}
                      </p>
                  </div>
                  <div>
                      <p className="text-xs uppercase font-bold opacity-60">Vendas Fechadas</p>
                      <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{stats.financialImpact.salesCount}</p>
                  </div>
                  <div>
                      <p className="text-xs uppercase font-bold opacity-60 flex items-center gap-1"><Target size={12}/> Taxa de Conversão</p>
                      <p className={`text-2xl font-bold ${darkMode ? 'text-blue-300' : 'text-blue-600'}`}>
                          {(stats.financialImpact.conversionRate * 100).toFixed(1)}%
                      </p>
                      <p className="text-[10px] opacity-60">Vendas / Envios com sucesso</p>
                  </div>
              </div>
          </div>
      )}

      {/* A/B TEST RESULTS (NEW) */}
      {stats.abTestAnalysis && (
          <div className={`p-6 rounded-xl border shadow-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
              <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                  <Split size={20} className="text-purple-500" /> Resultados do Teste A/B
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <div className="space-y-4">
                      <div className={`p-4 rounded-lg border ${stats.abTestAnalysis.winner === 'A' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-gray-200 dark:border-slate-700'}`}>
                          <div className="flex justify-between items-center mb-2">
                              <span className="font-bold text-lg">Variante A</span>
                              {stats.abTestAnalysis.winner === 'A' && <span className="bg-emerald-500 text-white text-xs px-2 py-1 rounded font-bold">VENCEDOR</span>}
                          </div>
                          <div className="flex justify-between text-sm">
                              <span>Envios: {stats.abTestAnalysis.variantA.count}</span>
                              <span className="font-bold">Taxa: {(stats.abTestAnalysis.variantA.rate * 100).toFixed(1)}%</span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
                              <div className="h-full bg-blue-500" style={{width: `${stats.abTestAnalysis.variantA.rate * 100}%`}}></div>
                          </div>
                      </div>

                      <div className={`p-4 rounded-lg border ${stats.abTestAnalysis.winner === 'B' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-gray-200 dark:border-slate-700'}`}>
                          <div className="flex justify-between items-center mb-2">
                              <span className="font-bold text-lg">Variante B</span>
                              {stats.abTestAnalysis.winner === 'B' && <span className="bg-emerald-500 text-white text-xs px-2 py-1 rounded font-bold">VENCEDOR</span>}
                          </div>
                          <div className="flex justify-between text-sm">
                              <span>Envios: {stats.abTestAnalysis.variantB.count}</span>
                              <span className="font-bold">Taxa: {(stats.abTestAnalysis.variantB.rate * 100).toFixed(1)}%</span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
                              <div className="h-full bg-purple-500" style={{width: `${stats.abTestAnalysis.variantB.rate * 100}%`}}></div>
                          </div>
                      </div>
                  </div>

                  <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={[
                              { name: 'Variante A', rate: stats.abTestAnalysis.variantA.rate * 100 },
                              { name: 'Variante B', rate: stats.abTestAnalysis.variantB.rate * 100 }
                          ]}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis />
                              <Tooltip formatter={(val: number) => val.toFixed(1) + '%'} />
                              <Bar dataKey="rate" fill="#8884d8">
                                  {
                                      [stats.abTestAnalysis.variantA, stats.abTestAnalysis.variantB].map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : '#8b5cf6'} />
                                      ))
                                  }
                              </Bar>
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
              </div>
          </div>
      )}

      {/* TABS */}
      <div className="flex gap-2">
          {['OVERVIEW', 'PERFORMANCE', 'ERRORS'].map(m => (
              <button 
                key={m}
                onClick={() => setViewMode(m as any)}
                className={`px-4 py-2 rounded-lg text-sm font-bold ${viewMode === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300'}`}
              >
                  {m}
              </button>
          ))}
      </div>

      {/* CONTENT */}
      <div className={`p-6 rounded-xl border shadow-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
          
          {viewMode === 'OVERVIEW' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                      <h3 className={`text-lg font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Distribuição de Tempo</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[
                                { name: 'Abrir WA', time: stats.stepAnalysis.averageTimeToOpenWhatsApp },
                                { name: 'Colar', time: stats.stepAnalysis.averageTimeToPaste },
                                { name: 'Enviar', time: stats.stepAnalysis.averageTimeToSend }
                            ]}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="time" fill="#8884d8" name="Segundos" />
                            </BarChart>
                        </ResponsiveContainer>
                      </div>
                  </div>
                  <div>
                      <h3 className={`text-lg font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Feedback Usuário</h3>
                      <div className="h-64">
                          {/* Placeholder for ratings chart if data exists */}
                          <div className="flex items-center justify-center h-full text-gray-400 border-2 border-dashed rounded-xl">
                              <span className="text-4xl font-bold text-yellow-500 mr-2">{stats.userRatings.average.toFixed(1)}</span> / 5.0
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {viewMode === 'PERFORMANCE' && (
              <div>
                  <h3 className={`text-lg font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Performance por Velocidade Configurada</h3>
                  <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={perfData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey="successRate" name="Sucesso (0-1)" fill="#82ca9d" />
                              <Bar dataKey="averageTime" name="Tempo Médio (s)" fill="#8884d8" />
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
              </div>
          )}

          {viewMode === 'ERRORS' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                      <h3 className={`text-lg font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Tipos de Erro</h3>
                      {errorData.length > 0 ? (
                          <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                      <Pie data={errorData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                          {errorData.map((entry, index) => (
                                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                          ))}
                                      </Pie>
                                      <Tooltip />
                                      <Legend />
                                  </PieChart>
                              </ResponsiveContainer>
                          </div>
                      ) : (
                          <div className="h-64 flex items-center justify-center text-green-500 font-bold">Sem erros registrados!</div>
                      )}
                  </div>
                  <div>
                      <h3 className={`text-lg font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Recomendações</h3>
                      <div className="space-y-2">
                          {stats.insights.map((insight, idx) => (
                              <div key={idx} className={`p-3 rounded border text-sm ${insight.type === 'WARNING' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                  <strong>{insight.type}:</strong> {insight.message}
                              </div>
                          ))}
                          {stats.insights.length === 0 && <p className="text-gray-500">Nenhuma recomendação no momento.</p>}
                      </div>
                  </div>
              </div>
          )}

      </div>
    </div>
  );
};

const MetricCard: React.FC<any> = ({ title, value, sub, icon, color, darkMode }) => {
    const bg = darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200';
    const txt = darkMode ? 'text-white' : 'text-gray-900';
    const subTxt = darkMode ? 'text-slate-400' : 'text-gray-500';
    
    const colorClasses: any = {
        blue: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30',
        green: 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30',
        purple: 'text-purple-500 bg-purple-100 dark:bg-purple-900/30',
        red: 'text-red-500 bg-red-100 dark:bg-red-900/30'
    };

    return (
        <div className={`p-4 rounded-xl border shadow-sm ${bg} flex items-center gap-4`}>
            <div className={`p-3 rounded-lg ${colorClasses[color]}`}>{icon}</div>
            <div>
                <p className={`text-xs font-bold uppercase ${subTxt}`}>{title}</p>
                <p className={`text-xl font-bold ${txt}`}>{value}</p>
                <p className={`text-xs ${subTxt}`}>{sub}</p>
            </div>
        </div>
    );
};

export default WhatsAppDashboard;
