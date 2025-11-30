export default {
  name: "menu",
  cmd: ["menu", "help", "list", "?"],
  type: "command",
  priority: 1,

  run: async (ctx) => {
    const user = ctx.user || {};
    const plugins = ctx.listPlugins();

    // Auto-generate command list (short)
    const cmdList = plugins
      .filter(p => p.type === "command")
      .map(p => {
        const mainCmd = Array.isArray(p.cmd) ? p.cmd[0] : p.cmd;
        return `• ${mainCmd}`;
      })
      .join("\n");

    const forwardedHeader = `_Use this bot wisely and don't abuse it_`;
    const body = `
*╭────── FANRABOT ─────❖*
*│* *User  :* ${user.name}
*│* *Bot    :* ${ctx.config.get("botName") || 'FanraBot'}
*│* *Date  :* ${new Date().toLocaleDateString()}
*╰───────────────────❖*
*╭───────────────────❖*
*│* \`Available Commands:\`
*│*
*│* • .menu
*│* • .kick
*│* • .ping
*│* • .myid
*│* • .help
*│* • .shop
*│* • .soon
*│*
*╰───────────────────❖*
`.trim();

    const bannerUrl =
      "https://images.unsplash.com/photo-1675897634504-bf03f1a2a66a?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mzl8fGFpfGVufDB8fDB8fHww";

    // TRY PREMIUM LOOK
    try {
      await ctx.react("📤");

      await ctx.sendMessage({
        text: `${forwardedHeader}\n\n${body}`,
        contextInfo: {
          isForwarded: true,
          forwardingScore: 999, // biar muncul "Forwarded many times"
          externalAdReply: {
            title: "FanraBot Official Menu",
            body: "Simple and Fast FanraBot",
            thumbnailUrl: bannerUrl,
            sourceUrl: "https://chat.whatsapp.com/IkJ1i2lSsiz3tBNAAR9K32",
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      });

      await ctx.react("✅");
      ctx.logger.info("MENU", `Forwarded-style menu sent to ${ctx.pushName}`);
    }

    // FALLBACK IF PREMIUM FAILS
    catch (e) {
      ctx.logger.warn("MENU", `Premium failed (${e.message}), fallback...`);

      try {
        await ctx.reply(`${forwardedHeader}\n\n${body}`);
        await ctx.react("☑️");
      } catch (err) {
        ctx.logger.error("MENU", `Failed to send fallback: ${err.message}`);
      }
    }
  }
};
