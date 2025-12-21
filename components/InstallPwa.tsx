
import React, { useEffect, useState } from 'react';
import { Download, Smartphone, Share, PlusSquare, X } from 'lucide-react';

interface InstallPwaProps {
  className?: string;
  isMobileMenu?: boolean;
}

const InstallPwa: React.FC<InstallPwaProps> = ({ className = "", isMobileMenu = false }) => {
  const [supportsPWA, setSupportsPWA] = useState(false);
  const [promptInstall, setPromptInstall] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    
    // Check if already standalone (installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

    if (isIosDevice && !isStandalone) {
        setIsIOS(true);
        setSupportsPWA(true);
    }

    // Detect Android/Desktop PWA Support
    const handler = (e: any) => {
      e.preventDefault();
      setSupportsPWA(true);
      setPromptInstall(e);
    };
    
    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const onClick = (evt: React.MouseEvent) => {
    evt.preventDefault();
    
    if (isIOS) {
        setShowIOSInstructions(true);
        return;
    }

    if (promptInstall) {
        promptInstall.prompt();
    }
  };

  if (!supportsPWA) {
    return null;
  }

  return (
    <>
        <button
          className={className}
          id="setup_button"
          aria-label="Instalar Aplicativo"
          title="Instalar Aplicativo"
          onClick={onClick}
        >
            {isMobileMenu ? <Smartphone size={20} /> : <Download size={16} />}
            <span>Instalar App</span>
        </button>

        {showIOSInstructions && (
            <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
                <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl w-full max-w-sm p-6 shadow-2xl relative">
                    <button 
                        onClick={() => setShowIOSInstructions(false)}
                        className="absolute top-4 right-4 text-gray-400 hover:text-white"
                    >
                        <X size={24} />
                    </button>
                    
                    <div className="text-center mb-6">
                        <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                            <Smartphone size={28} className="text-white"/>
                        </div>
                        <h3 className="text-lg font-bold">Instalar no iPhone</h3>
                        <p className="text-sm text-slate-400 mt-1">Siga os passos abaixo para adicionar o app à sua tela inicial.</p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-4 p-3 rounded-lg bg-white/5 border border-white/10">
                            <Share size={24} className="text-blue-400" />
                            <div className="text-sm">
                                1. Toque no botão <strong>Compartilhar</strong> na barra inferior do Safari.
                            </div>
                        </div>
                        <div className="flex items-center gap-4 p-3 rounded-lg bg-white/5 border border-white/10">
                            <PlusSquare size={24} className="text-gray-200" />
                            <div className="text-sm">
                                2. Role para cima e toque em <strong>Adicionar à Tela de Início</strong>.
                            </div>
                        </div>
                    </div>
                    
                    <div className="mt-6 text-center">
                        <button 
                            onClick={() => setShowIOSInstructions(false)}
                            className="text-emerald-400 font-bold text-sm"
                        >
                            Entendi, fechar
                        </button>
                    </div>
                </div>
            </div>
        )}
    </>
  );
};

export default InstallPwa;
