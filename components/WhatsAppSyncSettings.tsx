
import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, Cloud, AlertCircle, CheckCircle } from 'lucide-react';
import { syncWhatsAppData, DEFAULT_SYNC_CONFIG } from '../services/whatsappSync';
import { WASyncConfig } from '../types';

interface WhatsAppSyncSettingsProps {
  darkMode: boolean;
}

const WhatsAppSyncSettings: React.FC<WhatsAppSyncSettingsProps> = ({ darkMode }) => {
  const [config, setConfig] = useState<WASyncConfig>(DEFAULT_SYNC_CONFIG);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<{type:'success'|'error', text:string} | null>(null);

  useEffect(() => {
      const saved = localStorage.getItem('whatsapp_sync_config');
      if (saved) setConfig(JSON.parse(saved));
  }, []);

  const handleSave = () => {
      localStorage.setItem('whatsapp_sync_config', JSON.stringify(config));
      setMsg({ type: 'success', text: 'Configurações salvas.' });
      setTimeout(() => setMsg(null), 3000);
  };

  const handleSyncNow = async () => {
      setSyncing(true);
      const res = await syncWhatsAppData(config, true);
      setSyncing(false);
      if (res.success) setMsg({ type: 'success', text: res.message });
      else setMsg({ type: 'error', text: res.message });
  };

  const toggleTable = (table: any) => {
      if (config.tablesToSync.includes(table)) {
          setConfig({...config, tablesToSync: config.tablesToSync.filter(t => t !== table)});
      } else {
          setConfig({...config, tablesToSync: [...config.tablesToSync, table]});
      }
  };

  const bgClass = darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200';
  const textClass = darkMode ? 'text-white' : 'text-gray-800';

  return (
    <div className={`p-6 rounded-xl border shadow-sm ${bgClass}`}>
        <div className="flex items-center gap-3 mb-6">
            <Cloud className="text-blue-500" size={24} />
            <h3 className={`text-lg font-bold ${textClass}`}>Backup & Sincronização WhatsApp</h3>
        </div>

        {msg && (
            <div className={`p-3 rounded-lg mb-4 text-sm flex items-center gap-2 ${msg.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {msg.type === 'success' ? <CheckCircle size={16}/> : <AlertCircle size={16}/>}
                {msg.text}
            </div>
        )}

        <div className="space-y-6">
            <div>
                <label className={`block text-sm font-bold mb-2 ${textClass}`}>Tabelas para Sincronizar</label>
                <div className="grid grid-cols-2 gap-3">
                    {['wa_contacts', 'wa_campaigns', 'wa_delivery_logs', 'wa_campaign_stats'].map(tbl => (
                        <label key={tbl} className={`flex items-center gap-2 p-3 rounded border cursor-pointer ${config.tablesToSync.includes(tbl as any) ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-slate-700'}`}>
                            <input type="checkbox" checked={config.tablesToSync.includes(tbl as any)} onChange={() => toggleTable(tbl)} />
                            <span className={`text-sm ${textClass}`}>{tbl.replace('wa_', '').toUpperCase()}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div>
                <label className={`block text-sm font-bold mb-2 ${textClass}`}>Frequência</label>
                <select 
                    className={`w-full p-2 rounded border ${darkMode ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-gray-300'}`}
                    value={config.syncFrequency}
                    onChange={(e) => setConfig({...config, syncFrequency: e.target.value as any})}
                >
                    <option value="REALTIME">Tempo Real (~30 min)</option>
                    <option value="HOURLY">A cada Hora</option>
                    <option value="DAILY">Diário</option>
                    <option value="MANUAL">Apenas Manual</option>
                </select>
            </div>

            <div className="flex items-center gap-2">
                <input type="checkbox" checked={config.includeErrorDetails} onChange={(e) => setConfig({...config, includeErrorDetails: e.target.checked})} />
                <span className={`text-sm ${textClass}`}>Incluir detalhes técnicos de erro (Logs)</span>
            </div>

            <div className="pt-4 flex gap-3">
                <button onClick={handleSave} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center gap-2">
                    <Save size={18} /> Salvar Config
                </button>
                <button onClick={handleSyncNow} disabled={syncing} className="flex-1 bg-emerald-600 text-white py-2 rounded-lg font-bold hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50">
                    <RefreshCw size={18} className={syncing ? "animate-spin" : ""} /> {syncing ? 'Sincronizando...' : 'Sincronizar Agora'}
                </button>
            </div>
        </div>
    </div>
  );
};

export default WhatsAppSyncSettings;
