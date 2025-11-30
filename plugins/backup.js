import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

export default {
    name: "backup",
    cmd: ["backup", "zip"],
    type: "command",
    priority: 1,

    run: async (ctx) => {
        // 1. Owner Check
        if (ctx.user?.role !== 'owner') {
            return ctx.reply("❌ Perintah ini hanya bisa digunakan oleh **Owner Bot**.");
        }

        await ctx.react("⏳");
        // Beri tahu jika di grup, file akan dikirim ke DM
        if (ctx.isGroup) {
            await ctx.reply("📩 Mengirim backup ke Private Chat (DM) demi keamanan...");
        }

        const outputFileName = `FanraBot_Backup_${new Date().toISOString().slice(0, 10)}.zip`;
        const outputFilePath = path.join(ROOT, outputFileName);
        
        const output = fs.createWriteStream(outputFilePath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.pipe(output);

        // --- 2. EXCLUSION LIST (PERBAIKAN KEAMANAN) ---
        const excludePatterns = [
            'node_modules/**', 
            'session/**',      
            'logs/**',
            'data/users.json', 
            '.npm/**',
            '*.zip',           
            outputFileName,
            'package-lock.json',
            '.env',            
            '.DS_Store'
        ];

        archive.glob('**/*', {
            cwd: ROOT,
            ignore: excludePatterns,
            dot: true 
        });

        await archive.finalize();

        output.on('close', async () => {
            try {
                const fileSizeKB = (fs.statSync(outputFilePath).size / 1024).toFixed(2);
                
                // 3. KIRIM KE DM (SENDER) BUKAN KE GRUP
                await ctx.sendMessage({ 
                    document: { url: outputFilePath },
                    mimetype: 'application/zip',
                    fileName: outputFileName,
                    caption: `✅ *Backup Berhasil!* \n📅 Tanggal: ${new Date().toLocaleDateString()}\n📦 Ukuran: ${fileSizeKB} KB\n🔒 _.env excluded_`,
                }, { jid: ctx.sender }); // <-- Kirim ke Pengirim (DM)
                
                if (ctx.isGroup) await ctx.react("✅");

            } catch (e) {
                ctx.logger.error('BACKUP', `Gagal kirim file: ${e.message}`);
                await ctx.reply("❌ Gagal mengirim file backup.");
            } finally {
                try { fs.unlinkSync(outputFilePath); } catch(e) {}
            }
        });

        output.on('error', (err) => {
            ctx.logger.error('BACKUP', `Archiving error: ${err.message}`);
            ctx.reply("❌ Gagal membuat file zip.");
        });
    }
};