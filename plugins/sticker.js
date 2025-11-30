import { Sticker, createSticker, StickerTypes } from 'wa-sticker-formatter';

export default {
    name: "sticker",
    cmd: ["s", "sticker", "stiker"],
    type: "command",
    priority: 2,

    run: async (ctx) => {
        try {
            const msg = ctx.raw?.message;
            // Deteksi tipe pesan: Gambar langsung atau Reply Gambar
            const isImage = msg?.imageMessage;
            const isVideo = msg?.videoMessage;
            const isQuotedImage = msg?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
            const isQuotedVideo = msg?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;

            if (!isImage && !isQuotedImage && !isVideo && !isQuotedVideo) {
                return ctx.reply("❌ Kirim gambar/video dengan caption *.s* atau reply gambar/video dengan *.s*");
            }

            await ctx.react("⏳");

            // Download Media (Menggunakan fitur bawaan Baileys untuk download)
            // Note: Pastikan engine kamu punya fungsi download, atau gunakan cara ini:
            const { downloadContentFromMessage } = (await import('@whiskeysockets/baileys')).default;
            
            let mediaType = isImage || isQuotedImage ? 'image' : 'video';
            let mediaMsg = isImage || isVideo || isQuotedImage || isQuotedVideo;
            
            const stream = await downloadContentFromMessage(mediaMsg, mediaType);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            // Batasi durasi video (max 10 detik agar tidak berat)
            if (mediaType === 'video' && buffer.length > 5 * 1024 * 1024) {
                return ctx.reply("❌ Video terlalu besar (Max 5MB).");
            }

            // Buat Stiker
            const sticker = new Sticker(buffer, {
                pack: ctx.config.get("botName") || 'FanraBot', // Nama Pack
                author: ctx.user?.name || 'User',              // Nama Author
                type: StickerTypes.FULL, 
                categories: ['🤩', '🎉'],
                quality: 50,
                background: 'transparent'
            });

            const stikerBuffer = await sticker.toBuffer();

            // Kirim
            await ctx.sendMessage({ sticker: stikerBuffer }, { quoted: ctx.raw });
            await ctx.react("✅");

        } catch (e) {
            ctx.logger.error('STICKER', e.message);
            ctx.reply("❌ Gagal membuat stiker. (Pastikan format support)");
        }
    }
};