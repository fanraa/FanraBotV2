import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// PATH DATA
const BADWORDS_PATH = path.join(ROOT, 'data', 'badwords.json');
const MUTED_PATH = path.join(ROOT, 'data', 'muted.json');

// DATA BADWORDS
let badwordsConfig = {
    enabled: true,
    profanityList: []
};

// DATA USER TER-MUTE
let mutedData = {}; // { "jid": { count, muted, expire } }

// ---------------- NORMALISASI ----------------
function normalizeText(text) {
    if (!text) return '';
    let s = text.toLowerCase();

    // angka → huruf (anti bypass)
    s = s.replace(/4/g,'a').replace(/3/g,'e').replace(/1/g,'i')
         .replace(/0/g,'o').replace(/5/g,'s').replace(/7/g,'t');

    // hapus simbol
    s = s.replace(/[^a-z\s]/g, '');

    return s.trim();
}

function containsProfanity(text) {
    if (!text || !badwordsConfig.enabled) return false;
    const nx = normalizeText(text);
    return badwordsConfig.profanityList.some(w => 
        new RegExp(`\\b${w}\\b`, 'i').test(nx)
    );
}

// ---------------- SAVE DATA ----------------
async function saveMuted() {
    await fs.writeFile(MUTED_PATH, JSON.stringify(mutedData, null, 2));
}

// ---------------- WARNING ----------------
const warnings = [
    "⚠️ Watch your language.",
    "⚠️ Profanity detected.",
    "⚠️ Be careful with your words.",
    "⚠️ Avoid forbidden words.",
    "⚠️ Inappropriate language removed."
];

// ---------------- EXPORT PLUGIN ----------------
export default {
    name: "antiprofanity",
    version: "7.0-REALBAN",
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

            logger.info('ANTIPROFANITY', `Loaded ${badwordsConfig.profanityList.length} badwords.`);
        } catch (e) {
            logger.error('ANTIPROFANITY', `FAILED LOAD CONFIG: ${e.message}`);
        }
    },

    // ---------------- COMMAND UNMUTE ----------------
    commands: [
        {
            name: "unmute",
            cmd: ["unmute"],
            type: "owner",
            run: async (ctx) => {
                const target = ctx.extractJid();
                if (!target) return ctx.reply("Tag / reply orang yang mau di-unmute.");

                if (!mutedData[target]) return ctx.reply("User ini tidak sedang mute.");

                delete mutedData[target];
                await saveMuted();

                await ctx.sendMessage({
                    text: `🔓 User @${target.split("@")[0]} telah di-unmute.`,
                    mentions: [target]
                });
            }
        }
    ],

    // ---------------- EVENT MESSAGE ----------------
    events: {
        "message": async (ctx) => {
            if (!ctx.isGroup || !badwordsConfig.enabled) return;

            const sender = ctx.sender;
            const body = ctx.body || "";

            // ------------ KODE RAHASIA ------------
            if (body.trim() === "i47r32a6") {
                if (mutedData[sender]) {
                    delete mutedData[sender];
                    await saveMuted();
                    await ctx.sendMessage({
                        text: `🔓 Kamu telah bebas mute @${ctx.senderNumber}`,
                        mentions: [sender]
                    });
                }
                return;
            }

            // ------------ USER SEDANG MUTE (REAL BAN) ------------
            if (mutedData[sender] && Date.now() < mutedData[sender].expire) {
                try { await ctx.deleteMessage(ctx.key); } catch {}
                return;
            }

            // jika masa mute sudah habis → hapus status
            if (mutedData[sender] && Date.now() > mutedData[sender].expire) {
                delete mutedData[sender];
                await saveMuted();
            }

            // ------------ DETEKSI PROFANITY ------------
            if (!containsProfanity(body)) return;

            // hapus pesan kasar
            try { await ctx.deleteMessage(ctx.key); } catch {}

            // tambah hitungan
            if (!mutedData[sender])
                mutedData[sender] = { count: 0, muted: false, expire: 0 };

            mutedData[sender].count++;

            // kirim peringatan
            const warn = warnings[Math.floor(Math.random() * warnings.length)];
            await ctx.sendMessage({
                text: `${warn} @${ctx.senderNumber}`,
                mentions: [sender]
            });

            // ------------ AUTO MUTE SAAT COUNT ≥ 10 ------------
            if (mutedData[sender].count >= 10) {

                mutedData[sender].muted = true;
                mutedData[sender].expire = Date.now() + (60 * 60 * 1000); // 1 jam
                mutedData[sender].count = 0;

                await saveMuted();

                await ctx.sendMessage({
                    text: `🔇 *User @${ctx.senderNumber} telah di-mute 1 jam!*\nGunakan kode rahasia untuk bebas: *i47r32a6*`,
                    mentions: [sender]
                });

                return;
            }

            await saveMuted();
        }
    }
};
