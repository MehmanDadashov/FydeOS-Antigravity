/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
import React, {useCallback, useEffect, useState, useRef} from 'react';
import {GeneratedContent} from './components/GeneratedContent';
import {ParametersPanel} from './components/ParametersPanel';
import {Window} from './components/Window';
import {APP_DEFINITIONS_CONFIG, INITIAL_MAX_HISTORY_LENGTH, ASSISTANT_INSTRUCTION} from './constants';
import {streamAppContent} from './services/geminiService';
import {AppDefinition, InteractionData} from './types';
import {GoogleGenAI, Modality} from '@google/genai';

const App: React.FC = () => {
  const [activeApp, setActiveApp] = useState<AppDefinition | null>(null);
  const [llmContent, setLlmContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [interactionHistory, setInteractionHistory] = useState<InteractionData[]>([]);
  const [isParametersOpen, setIsParametersOpen] = useState<boolean>(false);
  const [currentMaxHistoryLength, setCurrentMaxHistoryLength] = useState<number>(INITIAL_MAX_HISTORY_LENGTH);
  const [isLauncherOpen, setIsLauncherOpen] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // AI Assistant States
  const [isAssistantActive, setIsAssistantActive] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const nextStartTime = useRef(0);
  const audioContext = useRef<AudioContext | null>(null);
  const outputNode = useRef<GainNode | null>(null);
  const sources = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const internalHandleLlmRequest = useCallback(
    async (historyForLlm: InteractionData[], maxHistoryLength: number) => {
      setIsLoading(true);
      setError(null);
      let accumulatedContent = '';
      try {
        const stream = streamAppContent(historyForLlm, maxHistoryLength);
        for await (const chunk of stream) {
          accumulatedContent += chunk;
          setLlmContent((prev) => prev + chunk);
        }
      } catch (e: any) {
        setError('Antigravity link severed. Recalibrating...');
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const handleInteraction = useCallback(
    async (interactionData: InteractionData) => {
      const newHistory = [
        interactionData,
        ...interactionHistory.slice(0, currentMaxHistoryLength - 1),
      ];
      setInteractionHistory(newHistory);
      setLlmContent('');
      internalHandleLlmRequest(newHistory, currentMaxHistoryLength);
    },
    [interactionHistory, internalHandleLlmRequest, currentMaxHistoryLength],
  );

  const handleAppOpen = (app: AppDefinition) => {
    setIsLauncherOpen(false);
    if (activeApp?.id === app.id) return;
    
    const initialInteraction: InteractionData = {
      id: app.id,
      type: 'app_open',
      elementText: app.name,
      elementType: 'icon',
      appContext: app.id,
    };

    const newHistory = [initialInteraction, ...interactionHistory.slice(0, currentMaxHistoryLength - 1)];
    setInteractionHistory(newHistory);
    setActiveApp(app);
    setLlmContent('');
    setError(null);
    internalHandleLlmRequest(newHistory, currentMaxHistoryLength);
  };

  const decodeBase64 = (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const startAssistant = async () => {
    if (isAssistantActive) {
      setIsAssistantActive(false);
      sources.current.forEach(s => s.stop());
      sources.current.clear();
      return;
    }

    setAssistantError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      if (!audioContext.current) {
        audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        outputNode.current = audioContext.current.createGain();
        outputNode.current.connect(audioContext.current.destination);
      }

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      setIsAssistantActive(true);

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              const bytes = new Uint8Array(int16.buffer);
              let binary = '';
              for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
              const base64 = btoa(binary);
              sessionPromise.then(s => s.sendRealtimeInput({ media: { data: base64, mimeType: 'audio/pcm;rate=16000' } }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (msg) => {
            const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData && audioContext.current && outputNode.current) {
              const bytes = decodeBase64(audioData);
              const dataInt16 = new Int16Array(bytes.buffer);
              const buffer = audioContext.current.createBuffer(1, dataInt16.length, 24000);
              const channelData = buffer.getChannelData(0);
              for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
              
              const source = audioContext.current.createBufferSource();
              source.buffer = buffer;
              source.connect(outputNode.current);
              nextStartTime.current = Math.max(nextStartTime.current, audioContext.current.currentTime);
              source.start(nextStartTime.current);
              nextStartTime.current += buffer.duration;
              sources.current.add(source);
              source.onended = () => sources.current.delete(source);
            }
            if (msg.serverContent?.interrupted) {
              sources.current.forEach(s => s.stop());
              sources.current.clear();
              nextStartTime.current = 0;
            }
          },
          onerror: (e) => {
            console.error("Neural Link Error:", e);
            setAssistantError("Antigravity connection lost.");
            setIsAssistantActive(false);
          },
          onclose: () => setIsAssistantActive(false)
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `${ASSISTANT_INSTRUCTION}. Core History: ${JSON.stringify(interactionHistory.slice(0, 5))}`,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
        }
      });

    } catch (e: any) {
      setAssistantError("Qrok initialization failed. Check Bio-permissions.");
      setIsAssistantActive(false);
    }
  };

  return (
    <div className="w-full h-screen relative bg-black overflow-hidden font-sans select-none">
      {/* Hyper-Aesthetic Wallpaper */}
      <div 
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000 opacity-60 mix-blend-color-dodge scale-110 blur-[2px]"
        style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&q=80&w=2070)' }}
      />
      
      {/* Floating Ambient Lights */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-500/10 blur-[120px] rounded-full animate-float" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[100px] rounded-full animate-float" style={{ animationDelay: '2s' }} />

      {/* OS Interface */}
      <div className="w-full h-full p-10 flex items-center justify-center pb-24 relative z-10">
        {activeApp && !isParametersOpen && (
          <Window title={activeApp.name} onClose={() => setActiveApp(null)} isAppOpen={true}>
            <div className="w-full h-full bg-black/10 backdrop-blur-3xl relative border border-white/5 rounded-b-[38px] overflow-hidden">
              {isLoading && llmContent.length === 0 && (
                <div className="flex flex-col justify-center items-center h-full gap-6">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 border-4 border-cyan-400/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin shadow-[0_0_30px_#22d3ee]"></div>
                  </div>
                  <span className="text-cyan-400 text-[11px] font-black tracking-[0.3em] uppercase animate-pulse">Neural Sync Active</span>
                </div>
              )}
              {error && <div className="p-8 text-red-400 font-mono text-[11px] uppercase tracking-widest bg-red-500/10 border border-red-500/20 m-4 rounded-2xl">{error}</div>}
              {llmContent && (
                <GeneratedContent
                  htmlContent={llmContent}
                  onInteract={handleInteraction}
                  appContext={activeApp.id}
                  isLoading={isLoading}
                />
              )}
            </div>
          </Window>
        )}

        {isParametersOpen && (
          <Window title="Antigravity Core Settings" onClose={() => setIsParametersOpen(false)} isAppOpen={true}>
             <ParametersPanel
                currentLength={currentMaxHistoryLength}
                onUpdateHistoryLength={setCurrentMaxHistoryLength}
                onClosePanel={() => setIsParametersOpen(false)}
                isStatefulnessEnabled={true}
                onSetStatefulness={() => {}}
              />
          </Window>
        )}
      </div>

      {/* Launcher Drawer */}
      {isLauncherOpen && (
        <div className="fixed bottom-20 left-10 w-[450px] bg-black/60 backdrop-blur-[60px] rounded-[48px] shadow-[0_30px_100px_rgba(0,0,0,1)] border border-white/10 p-10 animate-in slide-in-from-bottom-12 duration-500 z-50">
          <div className="grid grid-cols-4 gap-10">
            {APP_DEFINITIONS_CONFIG.map(app => (
              <div 
                key={app.id} 
                className="flex flex-col items-center gap-4 cursor-pointer group active:scale-90 transition-all"
                onClick={() => handleAppOpen(app)}
              >
                <div className="w-16 h-16 bg-white/5 rounded-[24px] flex items-center justify-center text-4xl group-hover:bg-cyan-500/30 group-hover:shadow-[0_0_40px_rgba(34,211,238,0.3)] group-hover:-translate-y-2 transition-all">
                  {app.icon}
                </div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-cyan-400 transition-colors">{app.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Neural Shelf */}
      <div className="fyde-shelf">
        <div className="flex items-center gap-8">
          <div 
            className={`fyde-launcher transition-all ${isLauncherOpen ? 'bg-cyan-500/30 shadow-[0_0_25px_#22d3ee]' : 'bg-white/5 border border-white/10'}`} 
            onClick={() => setIsLauncherOpen(!isLauncherOpen)}
          >
            <div className={`w-5 h-5 rounded-full border-2 ${isLauncherOpen ? 'border-white' : 'border-cyan-400'} animate-pulse`}></div>
          </div>
          
          <div className="flex items-center gap-3">
            {APP_DEFINITIONS_CONFIG.slice(0, 5).map(app => (
              <div 
                key={app.id} 
                className={`fyde-shelf-icon group ${activeApp?.id === app.id ? 'active bg-white/10 shadow-[inset_0_0_15px_rgba(255,255,255,0.05)]' : ''}`}
                onClick={() => handleAppOpen(app)}
              >
                <span className="text-2xl group-hover:scale-125 group-hover:-translate-y-1 transition-all">{app.icon}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-8">
          {/* Qrok Neural Heart */}
          <div 
            className={`flex items-center gap-4 px-6 h-11 rounded-full cursor-pointer transition-all ${isAssistantActive ? 'bg-cyan-500/30 border border-cyan-400/50 shadow-[0_0_30px_rgba(34,211,238,0.4)]' : 'bg-white/5 border border-white/10 hover:bg-white/10'}`}
            onClick={startAssistant}
          >
            <div className="qrok-orb">
              <div className={`absolute inset-0 rounded-full bg-cyan-400 ${isAssistantActive ? 'animate-ping' : ''}`} />
              <div className={`absolute inset-0 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]`} />
            </div>
            <span className="text-[11px] font-black text-cyan-400 tracking-[0.2em] uppercase">Qrok Neural</span>
          </div>

          <div className="px-6 py-2.5 rounded-full flex items-center gap-6 text-white text-[12px] font-black bg-white/5 border border-white/5 backdrop-blur-md">
            <span className="tracking-tighter">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
            <div className="flex items-center gap-3 opacity-80">
              <span className="text-cyan-400">📶</span>
              <span className="text-emerald-400">🔋</span>
            </div>
          </div>
          
          <div className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 cursor-pointer transition-all active:scale-90" onClick={() => setIsParametersOpen(true)}>
            <span className="text-2xl opacity-60 hover:opacity-100 transition-opacity">⚙️</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;