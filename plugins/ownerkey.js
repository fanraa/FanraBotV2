export default {
    name: "ownerkey",
    // FIX: Daftarkan command dalam huruf kecil agar sesuai dengan output dari core/index.js
    cmd: ["codei47r32a6"], 
    type: "command",
    priority: 1,

    run: async (ctx) => {
        // ctx.command sudah pasti huruf kecil ("codei47r32a6")
        if (ctx.command === "codei47r32a6") {

            const user = ctx.user;
            
            if (!user) {
                ctx.logger.error('OWNERKEY', `Gagal mendapatkan user data untuk ID: ${ctx.senderNumber}`);
                return ctx.reply("❌ Gagal memproses data Anda. Coba kirim pesan teks biasa dulu.");
            }

            // Cek apakah user sudah Owner
            if (user.role === 'owner') {
                return ctx.reply("👑 Anda sudah terdaftar sebagai Owner.");
            }
            
            // --- AKTIVASI OWNER ---
            user.role = 'owner';
            
            // Simpan perubahan role ke database (users.json)
            // Fungsi ini tersedia karena kita sudah update core/index.js
            await ctx.saveUsers(); 

            await ctx.reply(`
🎉 *KODE DITERIMA!*
Selamat @${ctx.senderNumber}, Anda sekarang adalah **OWNER** bot. 
Role Anda telah diperbarui di database.
            `.trim(), { mentions: [ctx.sender] });

            ctx.logger.info('OWNERKEY', `SUCCESS: ${ctx.senderNumber} activated Owner role.`);

        }
    }
};