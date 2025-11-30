import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { fileURLToPath } from 'url'; // <-- DIIMPORT DENGAN BENAR

const __dirname = path.dirname(fileURLToPath(import.meta.url)); // <-- DIPERBAIKI: fileURLToPath
const ROOT = path.resolve(__dirname, '..'); // Root folder proyek bot

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
        await ctx.reply("⏳ Memulai kompresi file bot. Ini akan sangat cepat dan kecil...");

        const outputFileName = `FanraBot_Backup_${new Date().toISOString().slice(0, 10)}.zip`;
        const outputFilePath = path.join(ROOT, outputFileName);
        
        // --- 2. SETUP ARCHIVER & EXCLUSION LIST ---
        const output = fs.createWriteStream(outputFilePath);
        const archive = archiver('zip', {
            zlib: { level: 9 } // Kompresi Maksimal
        });

        archive.pipe(output);

        // DAFTAR FILE/FOLDER YANG HARUS DIABAIKAN (Wajib Exclude)
        const excludePatterns = [
            'node_modules/**', // <- Penyebab file 18MB!
            'session/**',      // <- Data login sensitif
            'logs/**',
            'data/users.json',
            '.npm/**',
            '*.zip',           
            outputFileName,
            'package-lock.json'
        ];

        // 3. EKSEKUSI ADD FILES (MENGGUNAKAN GLOB PATTERN)
        archive.glob('**/*', {
            cwd: ROOT,
            ignore: excludePatterns,
            dot: true 
        });

        // 4. Finalisasi and Sending
        await archive.finalize();

        output.on('close', async () => {
            try {
                const fileSizeKB = (fs.statSync(outputFilePath).size / 1024).toFixed(2);
                
                await ctx.sendMessage({ 
                    document: { url: outputFilePath },
                    mimetype: 'application/zip',
                    fileName: outputFileName,
                    caption: `✅ *Backup Berhasil!* \nFile: ${outputFileName} \nUkuran: ${fileSizeKB} KB. (Kode Inti Saja)`,
                }, { jid: ctx.chatId });
                
                await ctx.react("✅");

            } catch (e) {
                ctx.logger.error('BACKUP', `Gagal kirim file: ${e.message}`);
                await ctx.reply("❌ Gagal mengirim file backup.");
            } finally {
                // Hapus file zip sementara setelah berhasil dikirim
                try {
                    fs.unlinkSync(outputFilePath);
                } catch(e) { /* ignore unlink error */ }
            }
        });

        output.on('error', (err) => {
            ctx.logger.error('BACKUP', `Archiving error: ${err.message}`);
            ctx.reply("❌ Gagal membuat file zip.");
        });
    }
};