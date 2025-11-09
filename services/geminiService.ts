
import { GoogleGenAI, Chat, GenerateContentResponse, Type } from "@google/genai";
import { ChatMessage, Grievance } from "./types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn("API_KEY environment variable not set. AI features will be disabled.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });
let chat: Chat | null = null;

const getChat = () => {
    if(!API_KEY) return null;
    if (!chat) {
        chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: "You are a helpful AI assistant for a public grievance redressal system. Your goal is to help citizens articulate their problems clearly. Ask clarifying questions to understand the issue, then summarize the grievance and suggest the most relevant government department to file the complaint with. Speak in the user's preferred language. Be concise and empathetic.",
            }
        });
    }
    return chat;
}

export const getChatbotResponse = async (history: ChatMessage[], newMessage: string): Promise<string> => {
    if(!API_KEY) return "AI services are currently unavailable.";
    try {
        const chatSession = getChat();
        if(!chatSession) return "AI services are currently unavailable.";
        
        const result = await chatSession.sendMessage({ message: newMessage });
        return result.text;
    } catch (error) {
        console.error("Error getting chatbot response:", error);
        return "Sorry, I encountered an error. Please try again.";
    }
};

export const generateSolutionForGrievance = async (grievance: Grievance): Promise<string> => {
    if(!API_KEY) return "AI services are currently unavailable.";
    try {
        const prompt = `
        Based on the following citizen grievance, suggest a concise and actionable solution for the relevant government department.
        
        Department: ${grievance.organization}
        Grievance Description: "${grievance.description}"
        
        Provide a practical, step-by-step solution that the department can implement.
        `;
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error generating solution:", error);
        return "Could not generate an AI solution at this time.";
    }
};

export const answerFromDocuments = async (grievance: Grievance, question: string): Promise<string> => {
    if(!API_KEY) return "AI services are currently unavailable.";
    try {
        // In a real application, you would extract text from uploaded documents (PDFs, images with OCR).
        // For this example, we'll just use the grievance description as the document context.
        const documentContext = grievance.description;

        const prompt = `
        You are an AI assistant for a government official. Your task is to answer questions based on the context provided from a citizen's grievance report.
        
        Context: "${documentContext}"
        
        Question: "${question}"
        
        Answer the question based ONLY on the provided context. If the answer is not in the context, say "The answer is not available in the provided documents."
        `;
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error answering from documents:", error);
        return "Could not get an answer at this time.";
    }
};

export const checkSpam = async (text: string): Promise<boolean> => {
    if(!API_KEY) return false;
    try {
        const prompt = `Analyze the following text and determine if it is a spam grievance or not. The text may be irrelevant, abusive, or nonsensical. Respond with only 'SPAM' or 'NOT_SPAM'.
        
        Text: "${text}"
        `;
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        const result = response.text.trim().toUpperCase();
        return result === 'SPAM';
    } catch (error) {
        console.error("Error checking for spam:", error);
        return false; // Fail open (assume not spam) on error
    }
};

export const parseGrievanceFromText = async (text: string, departments: string[]): Promise<{ department: string; description: string; error?: string; }> => {
    if (!API_KEY) return { department: '', description: '', error: "AI services are currently unavailable." };
    try {
        const systemInstruction = `You are an AI assistant helping a user file a grievance from a voice transcript. Your task is to extract the government department and a clear description of the problem.

The available departments are: ${departments.join(', ')}.

Analyze the following transcript and return a JSON object with two keys: "department" and "description".
- "department": Choose the single best match from the provided list of available departments. If no specific department is mentioned or can be reasonably inferred, return an empty string.
- "description": Summarize the user's issue into a clear and concise grievance description. Capture the core problem.

Respond only with the JSON object.`;

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: text, // User's transcript is the main content
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        department: {
                            type: Type.STRING,
                            description: `The most relevant department from the list: ${departments.join(', ')}.`
                        },
                        description: {
                            type: Type.STRING,
                            description: "A summary of the user's grievance."
                        }
                    },
                    required: ['department', 'description']
                }
            }
        });

        const jsonString = response.text.trim();
        const parsedData = JSON.parse(jsonString);

        if (parsedData.department && !departments.includes(parsedData.department)) {
             const lowerCaseDepartments = departments.map(d => d.toLowerCase());
             const lowerCaseParsed = parsedData.department.toLowerCase();
             const match = departments.find(d => d.toLowerCase().includes(lowerCaseParsed) || lowerCaseParsed.includes(d.toLowerCase()));
             if(match) {
                parsedData.department = match;
             } else {
                console.warn(`AI returned an invalid department: "${parsedData.department}". Resetting.`);
                parsedData.department = '';
             }
        }

        return parsedData;

    } catch (error) {
        console.error("Error parsing grievance from text:", error);
        return { department: '', description: '', error: "Could not understand the grievance. Please try again." };
    }
};