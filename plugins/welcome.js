// plugins/welcome.js
// Immediate Welcome Message (No Batching/Delay) - FINAL ANTI-FAIL VERSION

// Semua logic queue dan timer dihapus. Sambutan dilakukan secara instan.

export default {
    name: "welcome",
    version: "3.0.0-IMMEDIATE", 
    priority: 99, 
    cmd: ["wlctest"],

    // --- EVENT LISTENER (Langsung Sambut) ---
    events: {
        'group-participants.update': async (update) => {
            const { id: chatId, participants, action } = update;
            
            if (action !== 'add') return;

            // Langsung sambut setiap member yang bergabung tanpa delay
            for (const memberJid of participants) {
                sendWelcomeMessage(chatId, [memberJid]);
            }
        }
    },
    
    // --- COMMAND HANDLER (.wlctest) ---
    run: async (ctx) => {
        if (ctx.command === 'wlctest') {
            // Owner Check
            if (ctx.user?.role !== 'owner') {
                return ctx.reply("❌ Perintah ini hanya untuk Owner Bot.");
            }
            
            const testJid = ctx.sender;
            
            // Langsung panggil fungsi sambutan
            sendWelcomeMessage(ctx.chatId, [testJid]);
            
            await ctx.reply(`
✅ *SIMULASI WELCOME* Berhasil!
- @${testJid.split('@')[0]} disimulasikan bergabung.
- Pesan sambutan dikirim *sekarang juga*.
            `.trim(), { mentions: [testJid] });
        }
    }
}


/**
 * Mengirim pesan selamat datang ke anggota yang baru bergabung.
 * @param {string} chatId - JID of the group.
 * @param {string[]} joiningMembers - Array of JIDs of the new members.
 */
async function sendWelcomeMessage(chatId, joiningMembers) {
    
    try {
        // Ambil Akses Engine dan Socket
        const engine = (await import('../core/index.js')).default;
        const sock = engine.mockWA.sock;
        const logger = engine.logger;
        
        if (!sock || !sock.sendMessage) {
            logger.error('WELCOME', 'Socket not ready or sendMessage function missing.');
            return;
        }

        // --- 1. Cek Izin & Ambil Data Grup ---
        let groupName = "This Group";
        let isBotAdmin = false;

        try {
            const groupMeta = await sock.groupMetadata(chatId);
            groupName = groupMeta.subject;
            
            // Cek apakah bot adalah admin
            const botId = sock.user.id.split(':')[0];
            isBotAdmin = groupMeta.participants.some(p => p.admin && p.id.includes(botId));
            
        } catch (e) {
            logger.warn('WELCOME', `PERMISSION CHECK FAILED: Cannot fetch metadata for fancy welcome. Bot is likely NOT ADMIN.`);
        }

        if (!isBotAdmin) {
             // FALLBACK: Kirim pesan non-tagging dan non-fancy jika bot bukan admin
             const simpleText = `Hello everyone! New member(s) joined ${groupName}. [Bot is NOT ADMIN, please make bot an Admin to enable mentions and full features.]`;
             await sock.sendMessage(chatId, { text: simpleText });
             logger.warn('WELCOME', `Sent simple welcome because bot is NOT ADMIN.`);
             return; // Stop di sini
        }


        // --- 2. Build Pesan Lengkap (Hanya jika Bot Admin) ---
        const memberTags = joiningMembers.map(jid => `@${jid.split('@')[0]}`).join(' ');

        const welcomeText = `
*WELCOME TO ${groupName.toUpperCase()}!*

Hello everyone! We have new member(s) joining us. Please read the group rules and enjoy your stay here.

Let's give a warm welcome to:
${memberTags}
        `.trim();

        // 3. Send the message (Dengan Mentions)
        await sock.sendMessage(chatId, { text: welcomeText, mentions: joiningMembers });
        
        logger.info('WELCOME', `SUCCESS: Sent immediate welcome message to ${joiningMembers.length} member(s) in ${groupName}.`);

    } catch (e) {
        // Log error dan coba kirim pesan error sederhana sebagai fallback
        const engine = (await import('../core/index.js')).default;
        engine.logger.error('WELCOME', `FATAL SEND ERROR: ${e.message}`);
        
        try {
            await engine.mockWA.sock.sendMessage(chatId, { text: `❌ FATAL ERROR mengirim welcome message. Bot mengalami masalah. (${e.message.slice(0, 50)}...)` });
        } catch {}
    }
}