
import { GoogleGenAI, Type } from "@google/genai";
import { Territory } from "../types";

// Função para obter a chave de forma segura
const getSafeApiKey = () => {
  try {
    return (typeof process !== 'undefined' && process.env?.API_KEY) ? process.env.API_KEY : "";
  } catch (e) {
    return "";
  }
};

const ai = new GoogleGenAI({ apiKey: getSafeApiKey() });

export const getTerritoryAnalysis = async (territory: Territory, center: { lat: number, lng: number }) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-native-audio-preview-12-2025",
      contents: `Analise este território conquistado em um jogo de corrida localizado em latitude ${center.lat} e longitude ${center.lng}. 
      Use o Google Maps para identificar o que existe nesta localização exata (pontos de referência, bairros, parques ou estabelecimentos).
      
      Dê um nome criativo para esse território baseado no que você encontrar no mapa e uma breve descrição estratégica de como defendê-lo.`,
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
    
    // Extract grounding sources
    const groundingSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
      title: chunk.maps?.title || "Google Maps Source",
      uri: chunk.maps?.uri || ""
    })).filter((s: any) => s.uri) || [];

    const text = response.text || "";
    const nameMatch = text.match(/Nome(?:\s+do\s+território)?:\s*(.+)/i);
    const strategyMatch = text.match(/Estratégia:\s*(.+)/is);

    return {
      newName: nameMatch ? nameMatch[1].trim() : territory.name,
      strategy: strategyMatch ? strategyMatch[1].trim() : "Defenda seu território com vigor!",
      sources: groundingSources
    };
  } catch (error) {
    console.error("Erro ao analisar território com Google Maps:", error);
    return null;
  }
};

export const getTrainingAdvice = async (distance: number, territoriesCount: number) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `O usuário correu ${distance.toFixed(2)}km hoje e possui ${territoriesCount} territórios conquistados. Dê uma dica curta e motivacional de "conquistador" para ele.`,
    });
    return response.text;
  } catch (error) {
    return "Continue correndo para dominar a cidade!";
  }
};
