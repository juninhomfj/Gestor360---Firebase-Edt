
import { getSystemConfig } from './logic';
import { AudioType, SystemConfig } from '../types';

export class AudioService {
  private static audioCache = new Map<string, HTMLAudioElement>();

  /**
   * Reproduz um som baseado no tipo configurado no sistema.
   * Se o som não estiver configurado, falha silenciosamente.
   */
  static async play(soundType: AudioType): Promise<void> {
    try {
      const config = await getSystemConfig();
      
      // If sounds are disabled globally, exit
      if (config.notificationSounds && config.notificationSounds.enabled === false) return;

      const soundData = this.getSoundData(config, soundType);
      
      // Fallback silencioso: se não houver configuração, não faz nada.
      if (!soundData || typeof soundData !== 'string' || soundData.trim() === '') return;

      const audio = this.getAudioInstance(soundData);
      
      // Reinicia o áudio se já estiver tocando ou terminou
      audio.currentTime = 0;
      
      // Apply volume from config if available
      if (config.notificationSounds?.volume !== undefined) {
          audio.volume = config.notificationSounds.volume;
      } else {
          audio.volume = 1.0;
      }
      
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`[AudioService] Falha ao reproduzir som (${soundType}):`, error);
          }
        });
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error(`[AudioService] Erro crítico ao tentar tocar ${soundType}:`, error);
      }
    }
  }

  /**
   * Mapeia o tipo de áudio para a propriedade correta na configuração.
   * Suporta o novo formato nested e o formato legado para transição suave.
   */
  private static getSoundData(config: SystemConfig, soundType: AudioType): string | undefined {
    // New nested structure (Part 2)
    if (config.notificationSounds?.sound) {
        return config.notificationSounds.sound;
    }

    // Legacy fallback (Part 2 transition)
    const soundMap: Record<AudioType, string | undefined> = {
      NOTIFICATION: config.notificationSound,
      ALERT: config.alertSound,
      SUCCESS: config.successSound,
      WARNING: config.warningSound,
    };
    return soundMap[soundType];
  }

  /**
   * Gerencia o cache de instâncias de áudio para evitar recriar objetos HTMLAudioElement
   * repetidamente, melhorando a performance.
   */
  private static getAudioInstance(soundData: string): HTMLAudioElement {
    if (!this.audioCache.has(soundData)) {
      const audio = new Audio(soundData);
      this.audioCache.set(soundData, audio);
    }
    return this.audioCache.get(soundData)!;
  }

  /**
   * Pré-carrega todos os sons configurados para evitar delay na primeira execução.
   */
  static async preload(): Promise<void> {
    try {
        const config = await getSystemConfig();
        const sounds = [
            config.notificationSounds?.sound,
            config.notificationSound,
            config.alertSound,
            config.successSound,
            config.warningSound
        ];

        sounds.forEach(soundData => {
            if (soundData && typeof soundData === 'string' && soundData.trim() !== '') {
                this.getAudioInstance(soundData);
            }
        });
    } catch (e) {
        // Ignora erros de preload
    }
  }
}
