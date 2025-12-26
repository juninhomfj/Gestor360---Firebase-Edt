import fetch from 'node-fetch';

const API_URL = process.env.EVOLUTION_API_URL;
const API_KEY = process.env.EVOLUTION_API_KEY;

export class EvolutionService {
  private static getHeaders() {
    return {
      'Content-Type': 'application/json',
      'apikey': API_KEY || ''
    };
  }

  static async instanceExists(instanceName: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_URL}/instance/fetchInstances`, {
        headers: this.getHeaders()
      });
      if (!res.ok) return false;
      const data: any = await res.json();
      return data.some((i: any) => i.instance.instanceName === instanceName);
    } catch (e) {
      return false;
    }
  }

  static async createInstance(instanceName: string) {
    const res = await fetch(`${API_URL}/instance/create`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        instanceName,
        token: instanceName,
        qrcode: true,
        number: ""
      })
    });
    return res.json();
  }

  static async connectInstance(instanceName: string) {
    const res = await fetch(`${API_URL}/instance/connect/${instanceName}`, {
      headers: this.getHeaders()
    });
    return res.json();
  }

  static async sendText(instanceName: string, phone: string, message: string) {
    const res = await fetch(`${API_URL}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        number: phone,
        options: {
          delay: 1200,
          presence: "composing",
          linkPreview: false
        },
        textMessage: {
          text: message
        }
      })
    });
    return res.json();
  }
}