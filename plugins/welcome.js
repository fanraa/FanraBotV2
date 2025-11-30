// plugins/welcome.js
// Immediate Welcome Message - Dedicated Handler

const WELCOME_MESSAGES = [
    "Welcome aboard! Glad to have you here.",
    "Hello there! Please read the rules and enjoy your stay.",
    "A warm welcome to our new member! Hope you enjoy the chat.",
    "Welcome to the group! Let's keep the conversations flowing.",
    "Hi! Great to see you join us.",
    "New member alert! Welcome!"
];

async function sendWelcome(ctx, chatId, participants) {
    try {
        const sock = ctx.bot.sock;
        if (!sock) return;

        // 1. Ambil Info Grup
        let groupName = "This Group";
        let isBotAdmin = false;

        try {
            const groupMeta = await sock.groupMetadata(chatId);
            groupName = groupMeta.subject;
            
            // Cek apakah bot admin (agar bisa tag member tanpa error privacy)
            const botId = sock.user.id.split(':')[0];
            isBotAdmin = groupMeta.participants.some(p => p.admin && p.id.includes(botId));
        } catch (e) {
            ctx.logger.warn('WELCOME', 'Failed to fetch group metadata.');
        }

        // 2. Pilih Pesan Acak
        const randomMsg = WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];

        // 3. Kirim Pesan
        if (isBotAdmin) {
            // Jika Admin: Pakai Mentions (Tag Member)
            const mentions = participants;
            const textMentions = participants.map(jid => `@${jid.split('@')[0]}`).join(' ');
            
            const fullText = `
*WELCOME TO ${groupName.toUpperCase()}*

${randomMsg}

Halo ${textMentions} 👋
Silakan baca deskripsi grup ya!
            `.trim();

            await sock.sendMessage(chatId, { text: fullText, mentions: mentions });
        } else {
            // Jika Bukan Admin: Teks Biasa (Tanpa Tag)
            const simpleText = `
Welcome to *${groupName}*!
${randomMsg}

(Note: Make me Admin to enable full welcome features)
            `.trim();
            
            await sock.sendMessage(chatId, { text: simpleText });
        }
        
        ctx.logger.info('WELCOME', `Welcome sent to ${participants.length} users in ${chatId}`);

    } catch (e) {
        ctx.logger.error('WELCOME', `Error sending welcome: ${e.message}`);
    }
}

export default {
    name: "welcome",
    version: "3.5.0-STABLE", 
    priority: 99, 
    cmd: ["wlctest"],

    events: {
        'group-participants.update': async (ctx) => {
            // Event ini dipicu oleh engine.dispatch('group-participants.update')
            const { id: chatId, participants, action } = ctx;
            
            // Hanya merespon jika ada member baru (add)
            if (action === 'add') {
                await sendWelcome(ctx, chatId, participants);
            }
        }
    },
    
    run: async (ctx) => {
        // Fitur Test Manual (.wlctest)
        if (ctx.command === 'wlctest') {
            if (ctx.user?.role !== 'owner') return ctx.reply("❌ Owner only.");
            
            await ctx.reply("🔄 Simulating welcome...");
            // Simulasi array participants berisi sender
            await sendWelcome(ctx, ctx.chatId, [ctx.sender]);
        }
    }
}