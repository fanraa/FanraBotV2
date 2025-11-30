export default {
  name: "antilink",
  version: "6.0.0-LIMIT",
  priority: 0,

  events: {
    message: async (ctx) => {
      try {
        if (!ctx.isGroup || !ctx.body) return;

        const text = ctx.body.trim().toLowerCase();

        // --- LINK DETECTION ---
        const waGroupLink = /chat\.whatsapp\.com\/[A-Za-z0-9-]{5,}/i;
        const isWaGroup = waGroupLink.test(text);
        const anyLink = /(https?:\/\/|www\.|ftp:\/\/|t\.me\/)[^\s]+/i.test(text);

        const safeDomains = [
          "youtube.com", "youtu.be", "google.com", "wikipedia.org",
          "facebook.com", "instagram.com", "tiktok.com", "twitter.com", "x.com",
          "wa.me"
        ];
        const isSafeLink = safeDomains.some(domain => text.includes(domain));

        // --- BLOCK RULES ---
        if (isWaGroup || (anyLink && !isSafeLink)) {
            
            // 1. VIOLATION HANDLING
            const user = ctx.user;
            const today = new Date().toISOString().split('T')[0];

            // Reset daily
            if (!user.antilink || user.antilink.date !== today) {
                user.antilink = { date: today, count: 0 };
            }

            // Add violation
            user.antilink.count += 1;
            const violationCount = user.antilink.count;

            ctx.logger.warn(
                'ANTILINK',
                `Link detected from ${ctx.pushName} | Violation #${violationCount}`
            );

            // 2. ALWAYS DELETE MESSAGE
            try {
                await ctx.deleteMessage(ctx.key);
            } catch (e) {
                ctx.logger.error('ANTILINK', `Failed to delete message: ${e.message}`);
            }

            // 3. WARNING (5×) & KICK (10×)
            if (violationCount === 5) {
                // --- 5TH WARNING ---
                const warnMsg = `
⚠️ *Heads Up!* (@${ctx.senderNumber})
You've dropped *5 links* today.
Please chill with the links, alright?  
If you hit *10 violations*, you'll be removed from the group. Stay safe. 🌿
`.trim();

                await ctx.sendMessage({
                    text: warnMsg,
                    mentions: [ctx.sender]
                });

            } else if (violationCount >= 10) {
                // --- KICK USER ---
                const kickMsg = `
🚫 *Link Limit Reached* (@${ctx.senderNumber})
You've hit the *10-link limit* today.
Unfortunately, you'll have to leave the group.  
Take care out there. 👋
`.trim();

                await ctx.sendMessage({
                    text: kickMsg,
                    mentions: [ctx.sender]
                });

                // Kick attempt
                try {
                    await ctx.bot.sock.groupParticipantsUpdate(
                        ctx.chatId,
                        [ctx.sender],
                        'remove'
                    );
                    ctx.logger.warn('ANTILINK', `User ${ctx.pushName} has been KICKED.`);
                } catch (e) {
                    ctx.logger.error(
                        'ANTILINK',
                        `Failed to kick user: ${e.message} (Bot not Admin?)`
                    );
                    await ctx.reply(
                        "❌ I couldn't remove the user. Please make sure I'm an *Admin*."
                    );
                }
            }

            // Silent delete for 1–4 or 6–9 violations
        }

      } catch (e) {
        ctx.logger.error('ANTILINK', `System Error: ${e.message}`);
      }
    }
  }
}
