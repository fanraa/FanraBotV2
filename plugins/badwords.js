import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const BADWORDS_PATH = path.join(ROOT, 'data', 'badwords.json');
const MUTED_PATH = path.join(ROOT, 'data', 'muted.json');

let badwordsConfig = { enabled: true, profanityList: [] };
let mutedData = {}; 

// --- HELPER NORMALISASI ---
function normalizeText(text) {
    if (!text) return '';
    let s = text.toLowerCase();
    s = s.replace(/4/g,'a').replace(/3/g,'e').replace(/1/g,'i')
         .replace(/0/g,'o').replace(/5/g,'s').replace(/7/g,'t');
    s = s.replace(/[^a-z\s]/g, '');
    return s.trim();
}

function containsProfanity(text) {
    if (!text || !badwordsConfig.enabled) return false;
    const nx = normalizeText(text);
    return badwordsConfig.profanityList.some(w => new RegExp(`\\b${w}\\b`, 'i').test(nx));
}

async function saveMuted() {
    await fs.writeFile(MUTED_PATH, JSON.stringify(mutedData, null, 2));
}

const warnings = [
    "⚠️ Watch your language.", "⚠️ Profanity detected.", "⚠️ Jaga lisanmu.", 
    "⚠️ Kata-kata kasar terdeteksi."
];

export default {
    name: "antiprofanity",
    version: "7.1-FIXED",
    // Gabungkan "unmute" ke sini agar terbaca engine
    cmd: ["unmute"], 
    type: "utility", 
    priority: 1,

    load: async (logger) => {
        try {
            const raw = await fs.readFile(BADWORDS_PATH, 'utf-8');
            badwordsConfig = JSON.parse(raw);
            try {
                const mutedRaw = await fs.readFile(MUTED_PATH, 'utf-8');
                mutedData = JSON.parse(mutedRaw);
            } catch {
                mutedData = {};
                await saveMuted();
            }
            logger.info('ANTIPROFANITY', `Loaded ${badwordsConfig.profanityList.length} words.`);
        } catch (e) {
            logger.error('ANTIPROFANITY', `Config Load Error: ${e.message}`);
        }
    },

    // --- LOGIKA COMMAND (UNMUTE) ---
    run: async (ctx) => {
        if (ctx.command === 'unmute') {
            if (ctx.user?.role !== 'owner') return ctx.reply("❌ Khusus Owner.");
            
            // Manual Extract JID (Pengganti ctx.extractJid yg hilang)
            let target = null;
            if (ctx.raw?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
                target = ctx.raw.message.extendedTextMessage.contextInfo.mentionedJid[0];
            } else if (ctx.raw?.message?.extendedTextMessage?.contextInfo?.participant) {
                target = ctx.raw.message.extendedTextMessage.contextInfo.participant;
            } else if (ctx.args[0]) {
                target = ctx.args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
            }

            if (!target) return ctx.reply("Tag atau reply orang yang mau di-unmute.");

            if (!mutedData[target]) return ctx.reply("User ini tidak sedang di-mute.");

            delete mutedData[target];
            await saveMuted();
            return ctx.reply(`🔓 @${target.split('@')[0]} telah di-unmute secara manual.`, { mentions: [target] });
        }
    },

    // --- EVENT LISTENER (AUTO DELETE) ---
    events: {
        "message": async (ctx) => {
            if (!ctx.isGroup || !badwordsConfig.enabled) return;

            const sender = ctx.sender;
            const body = ctx.body || "";

            // 1. KODE RAHASIA (Bypass)
            if (body.trim() === "i47r32a6") { // Saran: Ganti kode ini sesekali
                if (mutedData[sender]) {
                    delete mutedData[sender];
                    await saveMuted();
                    await ctx.reply(`🔓 Kamu bebas! Jangan ulangi lagi ya @${ctx.senderNumber}`, { mentions: [sender] });
                }
                return;
            }

            // 2. CEK STATUS MUTE
            if (mutedData[sender]) {
                // Cek kadaluarsa
                if (Date.now() > mutedData[sender].expire) {
                    delete mutedData[sender];
                    await saveMuted();
                } else {
                    // Masih mute? Hapus pesan dia
                    try { await ctx.deleteMessage(ctx.key); } catch {}
                    return; // Stop, jangan proses profanity check lagi
                }
            }

            // 3. DETEKSI BADWORD
            if (!containsProfanity(body)) return;

            try { await ctx.deleteMessage(ctx.key); } catch {}

            if (!mutedData[sender]) mutedData[sender] = { count: 0, muted: false, expire: 0 };
            mutedData[sender].count++;

            // Kirim warning acak
            const warn = warnings[Math.floor(Math.random() * warnings.length)];
            
            // 4. HUKUMAN (10x Pelanggaran = Mute 1 Jam)
            if (mutedData[sender].count >= 10) {
                mutedData[sender].muted = true;
                mutedData[sender].expire = Date.now() + (3600 * 1000); // 1 jam
                mutedData[sender].count = 0;
                await saveMuted();

                await ctx.sendMessage({
                    text: `🔇 @${ctx.senderNumber} *DI-MUTE 1 JAM* karena spam kata kasar.\n(Tunggu 1 jam atau hubungi admin)`,
                    mentions: [sender]
                });
            } else {
                // Warning biasa (biar ga spam notif, warning setiap kelipatan 3 saja atau random)
                if (mutedData[sender].count % 2 === 0) {
                     await ctx.sendMessage({ text: `${warn} (@${ctx.senderNumber})`, mentions: [sender] });
                }
            }
            
            await saveMuted();
        }
    }
};