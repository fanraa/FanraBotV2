import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

export default {
    name: "sticker",
    cmd: ["s", "sticker", "stiker", "sg"],
    type: "command",
    priority: 2,

    run: async (ctx) => {
        try {
            const msg = ctx.raw?.message;
            // Deteksi tipe pesan: Gambar/Video langsung atau Reply
            const isImage = msg?.imageMessage;
            const isVideo = msg?.videoMessage;
            
            const quoted = ctx.raw?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const isQuotedImage = quoted?.imageMessage;
            const isQuotedVideo = quoted?.videoMessage;

            if (!isImage && !isQuotedImage && !isVideo && !isQuotedVideo) {
                return ctx.reply("❌ Kirim gambar/video dengan caption *.s* atau reply gambar/video dengan *.s*");
            }

            await ctx.react("⏳");

            // Tentukan tipe media dan pesan yang mau didownload
            let mediaType;
            let mediaMessage;

            if (isImage || isQuotedImage) {
                mediaType = 'image';
                mediaMessage = isImage ? isImage : isQuotedImage;
            } else {
                mediaType = 'video';
                mediaMessage = isVideo ? isVideo : isQuotedVideo;
            }

            // Download Stream
            const stream = await downloadContentFromMessage(mediaMessage, mediaType);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            // Cek ukuran video (max 10MB)
            if (mediaType === 'video' && buffer.length > 10 * 1024 * 1024) {
                return ctx.reply("❌ Video terlalu besar (Max 10MB).");
            }

            // Buat Stiker
            const sticker = new Sticker(buffer, {
                pack: ctx.config.get("botName") || 'FanraBot', 
                author: ctx.user?.name || 'User',              
                type: StickerTypes.CROPPED, // <--- UBAH DI SINI (Agar jadi kotak 1x1 penuh)
                categories: ['🤩', '🎉'],
                quality: 60, // Kualitas gambar
                background: 'transparent'
            });

            const stikerBuffer = await sticker.toBuffer();

            // Kirim Stiker
            await ctx.sendMessage({ sticker: stikerBuffer }, { quoted: ctx.raw });
            await ctx.react("✅");

        } catch (e) {
            ctx.logger.error('STICKER', `Error: ${e.message}`);
            await ctx.reply(`❌ Gagal membuat stiker: ${e.message}`);
        }
    }
};