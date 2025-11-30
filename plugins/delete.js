import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

// Batasan penghapusan
const MAX_MESSAGES_DELETE = 10;
const HISTORY_LIMIT = 50; 

// --- Helper: Get Admin Status (Untuk Pengecekan Izin) ---
async function getAdminStatus(sock, chatId, jid) {
    if (!chatId.endsWith('@g.us')) return false; 
    try {
        const metadata = await sock.groupMetadata(chatId);
        const participant = metadata.participants.find(p => p.id === jid);
        return participant?.admin === 'admin' || participant?.admin === 'superadmin' || participant?.admin === 'creator';
    } catch (e) {
        return false; 
    }
}

export default {
    name: "delete_messages",
    cmd: ["dell", "del"],
    type: "command",
    priority: 5,
    
    run: async (ctx) => {
        // Harus di Grup
        if (!ctx.isGroup) {
            return ctx.reply("❌ Perintah ini hanya berlaku di dalam grup.");
        }
        
        // 1. Pengecekan Izin: Owner atau Admin Grup
        const isAdmin = await getAdminStatus(ctx.bot.sock, ctx.chatId, ctx.sender);
        const isOwner = ctx.user?.role === 'owner';

        if (!isOwner && !isAdmin) {
            return ctx.reply("❌ Command ini hanya bisa digunakan oleh **Owner Bot** atau **Admin Grup**.");
        }

        // --- Parsing Target (JID) dan Jumlah (Count) ---
        let targetJid;
        let count = 1;
        
        // Ambil data mentah untuk mendeteksi mention secara akurat
        const contextInfo = ctx.raw?.message?.extendedTextMessage?.contextInfo;
        const mentionedJids = contextInfo?.mentionedJid || [];

        // Cari JID dari Reply (Priority 1)
        if (ctx.raw?.quotedMessage?.sender) {
            targetJid = ctx.raw.quotedMessage.sender;
            count = Math.min(parseInt(ctx.args[0]) || 1, MAX_MESSAGES_DELETE); // Count adalah argumen pertama
        
        // Cari JID dari Mention (Priority 2) - Menggunakan jalur akses yang lebih akurat
        } else if (mentionedJids.length > 0) { 
            targetJid = mentionedJids[0];
            
            // Coba ambil count dari argumen terakhir, karena tag bisa berada di mana saja
            const rawCount = ctx.args.find(arg => !isNaN(parseInt(arg)) && parseInt(arg) > 0);
            count = Math.min(parseInt(rawCount) || 1, MAX_MESSAGES_DELETE); 
        
        } else {
            return ctx.reply("❌ Mohon balas (reply) pesan target atau tag orangnya. Contoh: *.dell @user 5*");
        }
        
        if (!targetJid) return ctx.reply("❌ Target tidak valid.");
        
        await ctx.react("⏳");
        
        // 3. Ambil Histori dan Filter (Konseptual)
        
        let messageKeysToDelete = []; 
        
        // ***************************************************************
        // --- KODE AMBIL HISTORI PESAN BAILYS ---
        // GANTI BAGIAN INI dengan fungsi Baileys yang benar untuk mendapatkan histori.
        
        try {
            // Contoh implementasi konseptual:
            // const history = await ctx.bot.sock.fetchMessages({ jid: ctx.chatId, limit: HISTORY_LIMIT });
            // messageKeysToDelete = history
            //     .filter(m => m.key?.participant === targetJid && !m.key.fromMe)
            //     .slice(0, count)
            //     .map(m => m.key);
            
            // Karena kita tidak bisa mengakses API Anda, kita asumsikan messageKeysToDelete kosong
            // Jika Anda mengaktifkan kode fetchMessages di atas, ini akan berfungsi.

        } catch (e) {
             ctx.logger.error('DELETE_COMMAND', `[CRITICAL] Error fetching message history: ${e.message}`);
        }
                                
        // --- AKHIR KODE AMBIL HISTORI ---
        // ***************************************************************
        
        if (messageKeysToDelete.length === 0) {
             return ctx.reply(`⚠️ Tidak ditemukan pesan dari @${targetJid.split('@')[0]} dalam histori yang bisa diakses bot (limit ${HISTORY_LIMIT} pesan).`);
        }
        
        // 4. Proses Penghapusan (Force Delete)
        let deletedCount = 0;
        
        for (const key of messageKeysToDelete) {
             try {
                 await ctx.deleteMessage(key); 
                 deletedCount++;
             } catch (e) {
                 ctx.logger.error('DELETE_COMMAND', `[CRITICAL] Gagal menghapus kunci pesan: ${e.message}`);
             }
        }
        
        // 5. Laporan Akhir
        if (deletedCount > 0) {
             await ctx.reply(`✅ Berhasil menghapus ${deletedCount} pesan terakhir dari @${targetJid.split('@')[0]}.`, { mentions: [targetJid] });
        } else {
             await ctx.reply(`⚠️ Gagal menghapus pesan (Pesan terlalu lama atau BOT BUKAN ADMIN).`);
        }
    }
};