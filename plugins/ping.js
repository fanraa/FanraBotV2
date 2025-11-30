export default {
  name: "ping",
  cmd: ["ping", "speed", "p"],
  type: "command",
  priority: 1,

  run: async (ctx) => {
    // Hitung kecepatan respon
    const start = Date.now();
    
    // Kirim pesan awal (biasanya tidak perlu react dulu biar cepat)
    await ctx.react("⚡");

    const latensi = Date.now() - start;
    
    // Kirim info server
    const os = await import('os');
    const cpus = os.cpus().length;
    const ram = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    
    const text = `
🚀 *PONG!*
⚡ Speed: ${latensi}ms
💻 RAM: ${ram} GB
🖥️ CPU: ${cpus} Core
`.trim();

    await ctx.reply(text);
  }
};