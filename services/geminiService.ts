import { GoogleGenAI, Modality, Part } from "@google/genai";
import { GenerationMode } from '../App';

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const fileToGenerativePart = async (file: File): Promise<Part> => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64Data = dataUrl.split(',')[1];
      resolve(base64Data);
    };
    reader.readAsDataURL(file);
  });

  return {
    inlineData: {
      data: await base64EncodedDataPromise,
      mimeType: file.type,
    },
  };
};

const dataUrlToGenerativePart = (dataUrl: string): Part => {
    const [header, data] = dataUrl.split(',');
    const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
    return {
        inlineData: {
            data,
            mimeType,
        }
    }
}

const ecommercePrompt = `**TAREFA:** A partir da imagem fornecida, recrie-a como uma fotografia de produto para e-commerce com a mais alta qualidade profissional, hiper-realista e pronta para publicação.

**DIRETRIZES ESSENCIAIS DE QUALIDADE:**

1.  **ILUMINAÇÃO DE ESTÚDIO:** Simule uma configuração de **lightbox profissional**. A iluminação deve ser perfeitamente difusa, suave e envolvente, eliminando completamente sombras duras e reflexos especulares indesejados. O produto deve ser iluminado de forma a destacar suas texturas e formas naturais.

2.  **FUNDO IMACULADO:** O fundo deve ser **branco puro (#FFFFFF), uniforme e absolutamente limpo**. É terminantemente proibido qualquer tipo de gradiente, textura ou **sombra projetada** do produto no fundo. O produto deve parecer flutuar em um espaço branco infinito.

3.  **HIPER-REALISMO E COR:** A renderização deve ser **extremamente realista**. As texturas dos materiais (plástico, papel, metal, tecido, etc.) devem ser autênticas e táteis. A **precisão de cor é crítica**; as cores devem ser vibrantes, mas 100% fiéis ao produto original, com um balanço de branco perfeitamente neutro, sem dominantes de cor.

4.  **NITIDEZ E DETALHE:** O produto inteiro deve estar em **foco absoluto e perfeitamente nítido** de ponta a ponta (grande profundidade de campo). As bordas devem ser limpas e definidas, sem aberrações cromáticas, halos ou desfoques de recorte.

5.  **ENQUADRAMENTO PROFISSIONAL:**
    *   **Proporção e Resolução:** A imagem final DEVE ser um quadrado perfeito (1:1) com resolução de 2048x2048 pixels.
    *   **Composição:** O produto deve ser **cuidadosamente centralizado** e dimensionado para ocupar uma porção significativa do quadro (aproximadamente 85-90%), garantindo uma **margem (padding) generosa e visualmente consistente** em todos os lados. Evite que o produto pareça muito pequeno ou muito grande a ponto de tocar as bordas. O objetivo é um enquadramento equilibrado e profissional.
`;

const socialPrompt = `**TAREFA:** A partir da imagem do produto fornecida, crie uma fotografia de ambiente (lifestyle) **hiper-realista e profissional** para redes sociais, que seja elegante e contextualizada.

**DIRETRIZES ESSENCIAIS DE ESTILO:**

1.  **CONTEXTO INTELIGENTE:** Analise o produto e crie um cenário que **complemente sua natureza e uso**. Por exemplo, um pote de geleia pode ser apresentado em uma mesa de café da manhã, enquanto um cosmético pode estar em um banheiro elegante. O objetivo é contar uma pequena história sobre o produto.

2.  **ESTÉTICA CONSISTENTE:** Mantenha uma estética **rústica-chique, artesanal e convidativa**. Utilize materiais naturais como madeira, pedra, linho ou cerâmica. A composição deve parecer autêntica e cuidadosamente arranjada, nunca artificial.

3.  **ILUMINAÇÃO E ATMOSFERA:**
    *   A iluminação deve ser **natural e suave**, como a luz de uma janela. Crie **sombras suaves e realistas** que deem profundidade e volume à cena. A atmosfera geral deve ser quente, acolhedora e sofisticada.

4.  **REALISMO E INTEGRAÇÃO DO PRODUTO:**
    *   O produto fornecido deve ser **perfeitamente integrado** ao cenário, com sombras e reflexos realistas que interagem com o ambiente.
    *   Mantenha a **fidelidade total ao produto original** (cores, texturas, rótulos).

5.  **ENQUADRAMENTO E FOCO:**
    *   **Proporção:** A imagem final DEVE ser um quadrado perfeito (1:1). Resolução: 2048x2048 pixels.
    *   **Foco:** O produto deve ser o ponto focal principal. Use uma profundidade de campo ligeiramente rasa (foco suave no fundo) para destacá-lo, mas garantindo que o contexto seja reconhecível.
    *   **Composição:** Siga princípios de composição fotográfica (como a regra dos terços) para um resultado visualmente atraente.
`;

const processApiResponse = (response: any): string[] => {
    const imageUrls: string[] = [];
    if (response.candidates && response.candidates.length > 0) {
        for (const candidate of response.candidates) {
            const part = candidate.content.parts.find(p => p.inlineData && p.inlineData.mimeType.startsWith('image/'));
            if (part) {
                const mimeType = part.inlineData.mimeType;
                const base64ImageBytes: string = part.inlineData.data;
                imageUrls.push(`data:${mimeType};base64,${base64ImageBytes}`);
            }
        }
    }

    if (imageUrls.length === 0) {
      throw new Error("Nenhuma imagem foi gerada na resposta da API.");
    }
    
    return imageUrls;
}

export const generateImages = async (imageFile: File, mode: GenerationMode): Promise<string[]> => {
  const imagePart = await fileToGenerativePart(imageFile);
  const prompt = mode === 'ECOMMERCE' ? ecommercePrompt : socialPrompt;

  try {
    const imagePromises = Array(4).fill(0).map(() => 
      ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            imagePart,
            { text: prompt },
          ],
        },
        config: {
          responseModalities: [Modality.IMAGE],
        },
      })
    );
    
    const responses = await Promise.all(imagePromises);
    const allImageUrls = responses.flatMap(processApiResponse);
    
    if (allImageUrls.length < 4) {
      throw new Error(`A API gerou apenas ${allImageUrls.length} de 4 imagens solicitadas.`);
    }

    return allImageUrls;

  } catch (error) {
    console.error("Erro na chamada da API Gemini (generateImages):", error);
    throw new Error("Falha ao gerar as imagens. Por favor, verifique o console para mais detalhes.");
  }
};

export const refineImage = async (base64DataUrl: string, prompt: string): Promise<string[]> => {
  const imagePart = dataUrlToGenerativePart(base64DataUrl);

  try {
     const imagePromises = Array(4).fill(0).map(() =>
        ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
            imagePart,
            { text: prompt },
            ],
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
        })
    );

    const responses = await Promise.all(imagePromises);
    const allImageUrls = responses.flatMap(processApiResponse);

    if (allImageUrls.length < 4) {
        throw new Error(`A API gerou apenas ${allImageUrls.length} de 4 imagens solicitadas.`);
    }
    
    return allImageUrls;

  } catch (error) {
    console.error("Erro na chamada da API Gemini (refineImage):", error);
    throw new Error("Falha ao refinar a imagem. Por favor, verifique o console para mais detalhes.");
  }
};