import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai'; 
import 'dotenv/config'; 

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const AI_DATA_PATH = path.join(ROOT, 'data', 'ai.json');

// --- KONFIGURASI AMAN (Dari .env) ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
const DM_COOLDOWN_MS = 10000; 
// -------------------------

let aiData = { botName: 'Bot', intents: [] };
let geminiClient; 
let lastDmTime = new Map(); 

// --- FUNGSI UTILITY ---
function cleanQuery(query) {
    if (!query) return '';
    let q = query.toLowerCase().trim();
    q = q.replace(/[.,\/#!$%\^&*;:{}=\-_`~()]/g, " ");
    q = q.replace(/\s+/g, ' ');
    return q;
}

function getRandomResponse(intentId) {
    const intent = aiData.intents.find(i => i.id === intentId);
    if (!intent || intent.responses.length === 0) return null;
    const responseList = intent.responses;
    return responseList[Math.floor(Math.random() * responseList.length)].replace('{{botName}}', aiData.botName);
}

// --- FUNGSI AI ---
async function getSmartIntent(query, isTargeted) {
    const q = cleanQuery(query); 
    
    // 1. Cek Pola Lokal
    const sortedIntents = aiData.intents.sort((a, b) => b.priority - a.priority);
    let matchedIntent = null;

    for (const intent of sortedIntents) {
        if (intent.id === 'unrecognized') continue; 
        for (const patternString of intent.patterns) {
            try {
                if (new RegExp(patternString, 'i').test(q)) {
                    matchedIntent = intent;
                    break; 
                }
            } catch (e) {}
        }
        if (matchedIntent) break;
    }
    
    if (matchedIntent) return matchedIntent;
    
    // 2. Gemini API
    if (geminiClient && query.length > 5 && (isTargeted || !query.includes('?'))) {
        try {
            const systemInstruction = `You are a helpful assistant named ${aiData.botName}. Keep responses concise, friendly, and primarily in English.`;

            const response = await geminiClient.models.generateContent({
                model: 'gemini-2.0-flash', 
                contents: [{ role: "user", parts: [{ text: query }] }],
                config: {
                    systemInstruction: systemInstruction,
                    temperature: 0.7 
                }
            });
            
            return {
                id: 'gemini_response',
                responses: [response.text()] 
            };
            
        } catch (e) {
            console.error('[GEMINI API ERROR]', e.message);
            return {
                id: 'unrecognized',
                responses: ["I am having trouble connecting to my AI brain right now."]
            };
        }
    }

    return null; 
}

export default {
    name: "ai_chat",
    version: "5.0.0-PURE", 
    priority: 5, 

    load: async (logger) => {
        try {
            const rawData = await fs.readFile(AI_DATA_PATH, 'utf-8');
            aiData = JSON.parse(rawData);
            logger.info('AI', `Loaded ${aiData.intents.length} intents.`);

            if (GEMINI_API_KEY) {
                geminiClient = new GoogleGenAI(GEMINI_API_KEY);
                logger.info('AI', 'Gemini Client initialized.');
            } else {
                logger.warn('AI', 'GEMINI_API_KEY is missing in .env');
            }
        } catch (e) {
            logger.error('AI', `Failed to load data: ${e.message}`);
        }
    },

    events: {
        'message': async (ctx) => {
            if (aiData.intents.length === 0) return; 

            const botJid = ctx.bot.sock.user.id;
            const contextInfo = ctx.raw?.message?.extendedTextMessage?.contextInfo;
            const participantReplied = contextInfo?.participant;
            const mentionedJids = contextInfo?.mentionedJid || [];
            
            const query = ctx.body || '';
            if (query.length < 2) return; 
            
            const isPrivateChat = !ctx.isGroup; 
            if (!isPrivateChat && participantReplied && participantReplied !== botJid) return;
            if (ctx.command) return;

            const isTargeted = mentionedJids.includes(botJid) || participantReplied === botJid;
            
            if (isPrivateChat) {
                const now = Date.now();
                const lastTime = lastDmTime.get(ctx.sender) || 0;
                if (now - lastTime < DM_COOLDOWN_MS) return; 
            }

            let matchedIntent = await getSmartIntent(query, isTargeted);
            let finalResponse = null;

            if (matchedIntent) {
                finalResponse = getRandomResponse(matchedIntent.id);
            } else if (isTargeted || isPrivateChat) { 
                finalResponse = getRandomResponse('unrecognized');
            }

            if (finalResponse) {
                await ctx.bot.sock.sendPresenceUpdate('composing', ctx.chatId);
                await ctx.utils.sleep(ctx.config.get('aiResponseDelay', 1000));
                await ctx.reply(finalResponse);
                await ctx.bot.sock.sendPresenceUpdate('paused', ctx.chatId);

                if (isPrivateChat) lastDmTime.set(ctx.sender, Date.now());
            }
        }
    }
};