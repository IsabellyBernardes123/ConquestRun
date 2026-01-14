
import { GoogleGenAI, Type } from "@google/genai";
import { Territory, Mission } from "../types";

// The API key must be obtained exclusively from process.env.API_KEY and used directly.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getTerritoryAnalysis = async (territory: Territory, center: { lat: number, lng: number }) => {
  try {
    const response = await ai.models.generateContent({
      // Maps grounding is only supported in Gemini 2.5 series models.
      model: "gemini-2.5-flash",
      contents: `Analise este território conquistado em um jogo de corrida localizado em latitude ${center.lat} e longitude ${center.lng}. 
      Use o Google Maps para identificar o que existe nesta localização exata.
      Dê um nome criativo para esse território e uma breve descrição estratégica.`,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: center.lat,
              longitude: center.lng
            }
          }
        }
      }
    });
    
    // Extracting Maps grounding chunks to provide verifiable sources.
    const groundingSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
      title: chunk.maps?.title || "Google Maps Source",
      uri: chunk.maps?.uri || ""
    })).filter((s: any) => s.uri) || [];

    // Extracting text output directly via the .text property as per guidelines.
    const text = response.text || "";
    const nameMatch = text.match(/Nome(?:\s+do\s+território)?:\s*(.+)/i);
    const strategyMatch = text.match(/Estratégia:\s*(.+)/is);

    return {
      newName: nameMatch ? nameMatch[1].trim() : territory.name,
      strategy: strategyMatch ? strategyMatch[1].trim() : "Defenda seu território com vigor!",
      sources: groundingSources
    };
  } catch (error) {
    console.error("Erro ao analisar território:", error);
    return null;
  }
};

export const generateDailyMissions = async (level: number): Promise<Mission[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Gere 3 missões táticas para um app de corrida gamificado. 
      O usuário está no nível ${level}. As missões devem ser:
      1. Uma de distância (km).
      2. Uma de conquista (novos setores).
      3. Uma de fortificação (correr em setor próprio).
      Retorne no formato JSON estrito: [{"title": string, "description": string, "target": number, "xpReward": number, "type": "distance" | "capture" | "fortify"}]`,
      config: { 
        responseMimeType: "application/json",
        // Recommended responseSchema for reliable JSON outputs.
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              target: { type: Type.NUMBER },
              xpReward: { type: Type.NUMBER },
              type: { type: Type.STRING }
            },
            required: ["title", "description", "target", "xpReward", "type"]
          }
        }
      }
    });
    
    const missions = JSON.parse(response.text || "[]");
    return missions.map((m: any, i: number) => ({
      ...m,
      id: `m-${Date.now()}-${i}`,
      current: 0,
      completed: false
    }));
  } catch (e) {
    return [
      { id: '1', title: 'Patrulha Básica', description: 'Corra 2km', target: 2, current: 0, xpReward: 200, type: 'distance', completed: false },
      { id: '2', title: 'Expansão', description: 'Conquiste 1 setor', target: 1, current: 0, xpReward: 500, type: 'capture', completed: false }
    ];
  }
};

export const getTrainingAdvice = async (distance: number, territoriesCount: number) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `O usuário correu ${distance.toFixed(2)}km hoje e possui ${territoriesCount} territórios. Dê uma dica curta de "general tático" motivacional.`,
    });
    return response.text || "Domine as ruas, corredor!";
  } catch (error) {
    return "Domine as ruas, corredor!";
  }
};
