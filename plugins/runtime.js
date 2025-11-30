import os from 'os';

function formatSize(bytes) {
    if (bytes >= 1073741824) { bytes = (bytes / 1073741824).toFixed(2) + " GB"; }
    else if (bytes >= 1048576) { bytes = (bytes / 1048576).toFixed(2) + " MB"; }
    else if (bytes >= 1024) { bytes = (bytes / 1024).toFixed(2) + " KB"; }
    else if (bytes > 1) { bytes = bytes + " bytes"; }
    else if (bytes == 1) { bytes = bytes + " byte"; }
    else { bytes = "0 bytes"; }
    return bytes;
}

export default {
    name: "runtime",
    cmd: ["ping", "info", "status", "runtime"],
    type: "command",
    priority: 1,

    run: async (ctx) => {
        const start = Date.now();
        
        // Kirim pesan awal untuk hitung kecepatan
        await ctx.react("⚡");

        const uptime = process.uptime();
        const uptimeStr = new Date(uptime * 1000).toISOString().substr(11, 8);
        
        const cpus = os.cpus();
        const cpuModel = cpus.length > 0 ? cpus[0].model : "Unknown CPU";
        const totalMem = formatSize(os.totalmem());
        const freeMem = formatSize(os.freemem());
        const platform = os.platform();

        const speed = Date.now() - start;

        const info = `
*⚙️ SYSTEM STATUS*

🟢 *Status:* Online
⚡ *Speed:* ${speed}ms
⏱️ *Uptime:* ${uptimeStr}

💻 *Server Info:*
• OS: ${platform}
• RAM: ${freeMem} free / ${totalMem} total
• CPU: ${cpuModel} (${cpus.length} cores)
`.trim();

        await ctx.reply(info);
    }
};