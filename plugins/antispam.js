// plugins/antispam.js
// 🛡️ ANTI-SPAM (Batch Delete) & ANTI-VIRTEX (Auto Kick Enabled)
// ==========================================

// Map untuk menyimpan data spam user
// Structure: chatId-sender -> { lastMsg, count, msgKeys[], timer }
const spamMap = new Map();

export default {
  name: "antispam",
  version: "2.1.0-STRICT",
  priority: 0, // Jalankan paling awal

  events: {
    message: async (ctx) => {
      try {
        if (!ctx.isGroup || !ctx.body) return;

        const { sender, chatId, body } = ctx;
        const now = Date.now();
        const keyId = `${chatId}:${sender}`;

        // ==========================================
        // 1. ANTI-VIRTEX / VIRUS (Prioritas Utama)
        // ==========================================
        const isVirtex = 
          body.length > 10000 || // 1. Teks kepanjangan (Overload buffer)
          /(.)\1{50,}/.test(body) || // 2. Karakter berulang 50x (Lagging UI)
          /[\u0300-\u036f]{15,}/.test(body) || // 3. Simbol Zalgo/Setan (Stacking height)
          /[\u202a-\u202e]/.test(body); // 4. RTL Override (Crash rendering)

        if (isVirtex) {
           ctx.logger.warn('SECURITY', `☣️ VIRTEX detected from ${ctx.pushName}`);
           
           // A. Hapus pesan virusnya langsung
           await ctx.deleteMessage(ctx.key);
           
           // B. KICK PELAKU (SUDAH DIAKTIFKAN)
           // Bot harus jadi Admin agar ini berfungsi
           await ctx.bot.sock.groupParticipantsUpdate(chatId, [sender], 'remove').catch((e)=>{
               ctx.logger.error('SECURITY', `Failed to kick virtex sender: ${e.message}`);
           });
           
           // C. Beritahu Grup
           await ctx.sendMessage({ 
             text: `☣️ @${ctx.senderNumber} *VIRUS DETECTED* \nUser has been kicked and message deleted for safety.`, 
             mentions: [sender] 
           });
           return; 
        }

        // ==========================================
        // 2. ANTI-SPAM (Batch Logic)
        // ==========================================
        
        // Admin Bypass (Admin bebas spam)
        let groupMeta;
        try { groupMeta = await ctx.bot.sock.groupMetadata(chatId); } catch { return; }
        const admins = (groupMeta.participants || []).filter(p => p.admin).map(p => p.id);
        if (admins.includes(sender)) return; 


        // Ambil data user dari RAM
        let userData = spamMap.get(keyId) || { 
            lastMsg: '', 
            count: 0, 
            msgKeys: [], 
            lastTime: 0 
        };

        // Reset jika pesan BEDA atau jeda waktu > 8 detik
        if (userData.lastMsg !== body || (now - userData.lastTime > 8000)) {
            userData = { 
                lastMsg: body, 
                count: 1, 
                msgKeys: [ctx.key], 
                lastTime: now 
            };
        } else {
            // Jika pesan SAMA dan CEPAT
            userData.count++;
            userData.lastTime = now;
            userData.msgKeys.push(ctx.key); 
        }

        // Update memori
        spamMap.set(keyId, userData);

        // --- LOGIKA HUKUMAN ---

        // A. Pesan ke 1-4: BIARKAN (Hanya disimpan di msgKeys)
        if (userData.count < 5) {
            return; 
        }

        // B. Pesan ke-5: WARNING + HAPUS DARI AWAL
        if (userData.count === 5) {
            ctx.logger.warn('SPAM', `⚠️ SPAM WARNING (5x) to ${ctx.pushName} - Batch Deleting...`);
            
            // Hapus semua pesan sebelumnya
            for (const key of userData.msgKeys) {
                try { await ctx.deleteMessage(key); } catch {}
            }
            
            userData.msgKeys = []; 
            spamMap.set(keyId, userData);

            await ctx.sendMessage({
                text: `⚠️ *ANTI-SPAM WARNING* (@${ctx.senderNumber})\nYou have spammed 5 times.\nPrevious messages deleted.\nNext action: *KICK*.`,
                mentions: [sender]
            });
            return;
        }

        // C. Pesan ke 6-9: HAPUS LANGSUNG
        if (userData.count > 5 && userData.count < 10) {
            await ctx.deleteMessage(ctx.key);
            return;
        }

        // D. Pesan ke-10: KICK
        if (userData.count >= 10) {
            ctx.logger.warn('SPAM', `🚫 EXTREME SPAM (10x) from ${ctx.pushName} -> KICK`);
            
            await ctx.deleteMessage(ctx.key);
            
            await ctx.sendMessage({ 
                text: `🚫 *LIMIT EXCEEDED*\nGoodbye @${ctx.senderNumber}! 👋`,
                mentions: [sender]
            });
            
            // Eksekusi Kick
            await ctx.bot.sock.groupParticipantsUpdate(chatId, [sender], 'remove').catch(() => {
                 ctx.reply('❌ Failed to kick (Bot not Admin?)');
            });
            
            spamMap.delete(keyId);
            return;
        }

      } catch (e) {
        ctx.logger.error('ANTISPAM', e.message);
      }
    }
  }
}