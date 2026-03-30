import { GoogleGenAI, Type } from "@google/genai";
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const financialTools = [
  {
    name: "get_inventory_data",
    description: "Get current inventory status, including product names, quantities, and low stock alerts.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING, description: "The company ID" }
      },
      required: ["companyId"]
    }
  },
  {
    name: "get_sales_data",
    description: "Get sales data and invoices for a specific period.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING, description: "The company ID" },
        period: { type: Type.STRING, description: "Period: 'today', 'this_week', 'this_month', or 'all'" }
      },
      required: ["companyId", "period"]
    }
  },
  {
    name: "get_treasury_data",
    description: "Get treasury transactions and current balance.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING, description: "The company ID" }
      },
      required: ["companyId"]
    }
  },
  {
    name: "get_accounting_data",
    description: "Get chart of accounts and journal entries.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        companyId: { type: Type.STRING, description: "The company ID" }
      },
      required: ["companyId"]
    }
  }
];

const toolImplementations: Record<string, Function> = {
  get_inventory_data: async ({ companyId }: { companyId: string }) => {
    const path = `users/${companyId}/products`;
    try {
      const q = query(collection(db, path), limit(50));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },
  get_sales_data: async ({ companyId, period }: { companyId: string, period: string }) => {
    const path = `users/${companyId}/invoices`;
    try {
      const q = query(collection(db, path), where('type', '==', 'sales'), limit(50));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },
  get_treasury_data: async ({ companyId }: { companyId: string }) => {
    const path = `users/${companyId}/transactions`;
    try {
      const q = query(collection(db, path), orderBy('date', 'desc'), limit(20));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },
  get_accounting_data: async ({ companyId }: { companyId: string }) => {
    const accountsPath = `users/${companyId}/accounts`;
    const entriesPath = `users/${companyId}/journalEntries`;
    try {
      const [accountsSnap, entriesSnap] = await Promise.all([
        getDocs(query(collection(db, accountsPath))),
        getDocs(query(collection(db, entriesPath), limit(50)))
      ]);
      return {
        accounts: accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        journalEntries: entriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, accountsPath);
    }
  }
};

export const generateFinancialResponse = async (messages: any[], companyId: string) => {
  const model = "gemini-3-flash-preview";
  
  // Ensure conversation history starts with a 'user' role
  const firstUserIndex = messages.findIndex(m => m.role === 'user');
  const validMessages = firstUserIndex !== -1 ? messages.slice(firstUserIndex) : messages;

  const response = await ai.models.generateContent({
    model,
    contents: validMessages,
    config: {
      systemInstruction: `
        You are Makhzanak AI (المساعد المالي الذكي), a professional financial and inventory assistant for the "Makhzanak" platform.
        Your goal is to provide real business insights based on the user's data.
        
        Guidelines:
        1. ALWAYS use the provided tools to fetch data before answering questions about sales, inventory, or finances.
        2. If the user asks a generic question, you can answer directly, but prefer data-driven answers.
        3. Format your responses using Markdown.
        4. Use tables and bullet points for clarity.
        5. If the data suggests a trend (e.g., declining sales or low stock), provide a proactive insight or recommendation.
        6. Respond in the same language as the user (Arabic or English).
        7. For charts, describe the data in a way that the UI can render it (e.g., "CHART_DATA: [JSON_DATA]").
        
        The current company ID is: ${companyId}
      `,
      tools: [{ functionDeclarations: financialTools }],
    },
  });

  // Handle function calls
  const functionCalls = response.functionCalls;
  if (functionCalls && functionCalls.length > 0) {
    const toolResults = await Promise.all(functionCalls.map(async (call) => {
      const implementation = toolImplementations[call.name];
      if (implementation) {
        const result = await implementation(call.args);
        return {
          name: call.name,
          response: { result }
        };
      }
      return null;
    }));

    // Send tool results back to model
    const secondResponse = await ai.models.generateContent({
      model,
      contents: [
        ...validMessages,
        response.candidates?.[0]?.content,
        {
          role: 'user',
          parts: toolResults.filter(r => r !== null).map(r => ({
            functionResponse: r
          }))
        }
      ],
      config: {
        systemInstruction: `
          You are Makhzanak AI (المساعد المالي الذكي), a professional financial and inventory assistant for the "Makhzanak" platform.
          Your goal is to provide real business insights based on the user's data.
          
          Guidelines:
          1. ALWAYS use the provided tools to fetch data before answering questions about sales, inventory, or finances.
          2. If the user asks a generic question, you can answer directly, but prefer data-driven answers.
          3. Format your responses using Markdown.
          4. Use tables and bullet points for clarity.
          5. If the data suggests a trend (e.g., declining sales or low stock), provide a proactive insight or recommendation.
          6. Respond in the same language as the user (Arabic or English).
          7. For charts, describe the data in a way that the UI can render it (e.g., "CHART_DATA: [JSON_DATA]").
          
          The current company ID is: ${companyId}
        `,
        tools: [{ functionDeclarations: financialTools }],
      },
    });
    return secondResponse;
  }

  return response;
};

export const generateSmartInsights = async (data: any, lang: 'ar' | 'en') => {
  const model = "gemini-3-flash-preview";
  const prompt = `
    Analyze this business data and provide 3 short, actionable insights or alerts.
    Data: ${JSON.stringify(data)}
    
    Return a JSON array of objects: [{ "title": "...", "description": "...", "type": "warning|info|success", "icon": "trending|package|wallet" }]
    Language: ${lang === 'ar' ? 'Arabic' : 'English'}
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json"
    }
  });

  try {
    return JSON.parse(response.text || '[]');
  } catch (e) {
    return [];
  }
};

export const parseVoiceCommand = async (transcript: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      Extract product information from this voice command: "${transcript}"
      Return a JSON object with: name, price, quantity.
      Example: "Add product Coca Cola price 20 quantity 50" -> { "name": "Coca Cola", "price": 20, "quantity": 50 }
    `,
    config: {
      responseMimeType: "application/json"
    }
  });
  
  try {
    return JSON.parse(response.text || '{}');
  } catch (e) {
    return null;
  }
};
