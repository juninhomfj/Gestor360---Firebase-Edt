
import React from 'react';
import { Check, CheckCheck, PlayCircle, Mic } from 'lucide-react';

interface WhatsAppPreviewProps {
  text: string;
  media?: string; // Base64
  mediaType?: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
  contactName?: string;
  isDarkMode: boolean;
}

const WhatsAppPreview: React.FC<WhatsAppPreviewProps> = ({ 
  text, 
  media, 
  mediaType, 
  contactName = "Contato Exemplo", 
  isDarkMode 
}) => {
  
  // Format text similar to WhatsApp (*bold*, _italic_, ~strike~)
  const formatText = (content: string) => {
    if (!content) return null;
    let formatted = content
      .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      .replace(/~(.*?)~/g, '<del>$1</del>')
      .replace(/\n/g, '<br/>');
    
    return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
  };

  const currentTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="w-full max-w-sm mx-auto border-8 border-gray-800 rounded-[2.5rem] overflow-hidden bg-white shadow-2xl relative">
        {/* Notch & Status Bar */}
        <div className="absolute top-0 left-0 right-0 h-6 bg-gray-800 z-20 flex justify-center">
            <div className="w-24 h-4 bg-black rounded-b-xl"></div>
        </div>

        {/* WhatsApp Header */}
        <div className="bg-[#075E54] text-white p-3 pt-8 flex items-center gap-3 relative z-10">
            <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-bold text-xs overflow-hidden">
                <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${contactName}`} alt="avatar" />
            </div>
            <div className="flex-1">
                <p className="font-bold text-sm truncate">{contactName}</p>
                <p className="text-[10px] opacity-80">visto por último hoje às {currentTime}</p>
            </div>
        </div>

        {/* Chat Area (Wallpaper) */}
        <div 
            className="bg-[#E5DDD5] h-[400px] overflow-y-auto p-4 flex flex-col gap-2 relative custom-scrollbar"
            style={{ 
                backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')",
                backgroundBlendMode: isDarkMode ? 'multiply' : 'normal',
                backgroundColor: isDarkMode ? '#0d1418' : '#E5DDD5'
            }}
        >
            {/* Example Incoming Message */}
            <div className={`self-start max-w-[80%] rounded-lg p-2 text-sm shadow-sm relative mb-2 ${isDarkMode ? 'bg-[#1f2c34] text-white' : 'bg-white text-black'}`}>
                <div className="absolute top-0 -left-2 w-0 h-0 border-t-[10px] border-t-transparent border-r-[10px] border-r-white dark:border-r-[#1f2c34] border-b-[10px] border-b-transparent"></div>
                <p className="leading-relaxed">Olá! Gostaria de saber mais sobre as promoções.</p>
                <span className="text-[10px] float-right mt-1 opacity-60 ml-2">09:30</span>
            </div>

            {/* Outgoing Message (PREVIEW) */}
            <div className={`self-end max-w-[85%] rounded-lg p-2 text-sm shadow-sm relative min-w-[100px] ${isDarkMode ? 'bg-[#005c4b] text-white' : 'bg-[#dcf8c6] text-black'}`}>
                <div className={`absolute top-0 -right-2 w-0 h-0 border-t-[10px] border-t-transparent border-l-[10px] border-b-[10px] border-b-transparent ${isDarkMode ? 'border-l-[#005c4b]' : 'border-l-[#dcf8c6]'}`}></div>
                
                {/* Media Preview */}
                {media && (
                    <div className="mb-2 rounded overflow-hidden relative bg-black/10 flex items-center justify-center min-h-[100px]">
                        {mediaType === 'IMAGE' && <img src={media} alt="Preview" className="w-full h-auto object-cover" />}
                        {mediaType === 'VIDEO' && (
                            <div className="w-full h-32 flex items-center justify-center bg-black">
                                <PlayCircle size={32} className="text-white opacity-80" />
                            </div>
                        )}
                        {mediaType === 'AUDIO' && (
                            <div className="flex items-center gap-3 p-3 w-full bg-white/20">
                                <PlayCircle size={24} className="text-gray-500 fill-current" />
                                <div className="h-1 bg-gray-400 flex-1 rounded-full"></div>
                                <Mic size={16} className="text-gray-500" />
                            </div>
                        )}
                    </div>
                )}

                <div className="leading-relaxed whitespace-pre-wrap break-words">
                    {formatText(text) || <span className="opacity-50 italic">Sua mensagem...</span>}
                </div>
                
                <div className="flex justify-end items-center gap-1 mt-1">
                    <span className="text-[10px] opacity-60">{currentTime}</span>
                    <CheckCheck size={14} className="text-blue-500" />
                </div>
            </div>
        </div>

        {/* Fake Input Area */}
        <div className={`p-2 flex items-center gap-2 ${isDarkMode ? 'bg-[#1f2c34]' : 'bg-[#f0f0f0]'}`}>
            <div className={`flex-1 rounded-full px-4 py-2 text-sm ${isDarkMode ? 'bg-[#2a3942] text-gray-400' : 'bg-white text-gray-400'}`}>
                Mensagem
            </div>
            <div className="w-10 h-10 rounded-full bg-[#008f72] flex items-center justify-center text-white">
                <Mic size={20} />
            </div>
        </div>
    </div>
  );
};

export default WhatsAppPreview;
