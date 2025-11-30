// plugins/group-admin.js
// 🛡️ Group Admin Tools — Clean Version

export default {
  name: "group-admin",
  cmd: ["kick", "add", "promote", "demote", "admin", "unadmin"],
  type: "command",
  priority: 2,

  run: async (ctx) => {
    try {
      if (!ctx.isGroup) return ctx.reply("🚫 This command is only available in groups.");

      // --- 1. AUTHENTICATION ---
      // Cek apakah user adalah Owner Bot ATAU Admin Grup
      const userDB = ctx.user;
      const isOwner = userDB && userDB.role === "owner";

      // Ambil metadata grup untuk cek admin
      let groupMeta;
      try { groupMeta = await ctx.bot.sock.groupMetadata(ctx.chatId); } catch {}
      
      const participants = groupMeta?.participants || [];
      const admins = participants.filter(p => p.admin).map(p => p.id);
      
      const senderNum = ctx.senderNumber;
      const isSenderAdmin = admins.some(id => id.includes(senderNum));

      if (!isSenderAdmin && !isOwner) {
        return ctx.reply("🛑 Only *Group Admins* (or Bot Owner) can use this command.");
      }

      // --- 2. TARGET PARSER ---
      let target;
      const firstArg = ctx.args[0] ? ctx.args[0].toLowerCase() : "";

      // Handle "me" target
      if (["me", "myself", "i", "aku", "gue"].includes(firstArg)) {
        if (["kick", "add"].includes(ctx.command)) 
          return ctx.reply("😅 You can't use that on yourself.");
        target = ctx.sender;
      } 
      // Handle Tag / Reply / Nomor HP
      else {
        const raw = ctx.raw?.message;
        const contextInfo = raw?.extendedTextMessage?.contextInfo 
                         || raw?.imageMessage?.contextInfo 
                         || raw?.videoMessage?.contextInfo;

        if (contextInfo?.mentionedJid?.length > 0) {
            target = contextInfo.mentionedJid[0];
        } else if (contextInfo?.participant) {
            target = contextInfo.participant;
        } else if (ctx.args.length > 0) {
            let input = ctx.args.join("").replace(/[^0-9]/g, "");
            if (input.startsWith("08")) input = "62" + input.slice(1);
            if (input.length > 5) target = input + "@s.whatsapp.net";
        }
      }

      if (!target) {
        return ctx.reply("⚠️ No target detected. Please *tag* a user or *reply* to their message.");
      }

      // --- 3. EXECUTE ACTION ---
      const targetNum = target.split("@")[0];
      const botId = ctx.bot.sock.user.id.split(":")[0];

      // Proteksi Bot
      if (target.includes(botId) && ctx.command !== "promote") {
        return ctx.reply("🤖 I cannot perform that action on myself.");
      }

      switch (ctx.command) {
        case "kick":
          try {
            await ctx.bot.sock.groupParticipantsUpdate(ctx.chatId, [target], "remove");
            await ctx.reply(`✅ Removed @${targetNum} from the group.`, { mentions: [target] });
          } catch (e) {
            await ctx.reply("🚫 Failed to kick. Make sure the bot is *Admin*.");
          }
          break;

        case "add":
          try {
            const res = await ctx.bot.sock.groupParticipantsUpdate(ctx.chatId, [target], "add");
            const status = res[0]?.status;

            if (status === "200") {
              await ctx.reply(`✨ Added @${targetNum} to the group.`, { mentions: [target] });
            } else if (status === "403") {
              await ctx.reply(`🔐 User privacy blocked adding. Sending invite link...`);
              const code = await ctx.bot.sock.groupInviteCode(ctx.chatId);
              await ctx.sendMessage({ text: `Join here: https://chat.whatsapp.com/${code}` }, { jid: target });
            } else {
              await ctx.reply(`❌ Add failed. User might be already in group.`);
            }
          } catch {
            await ctx.reply("🚫 Failed to add. Make sure I'm an *Admin*.");
          }
          break;

        case "promote":
        case "admin":
          try {
            await ctx.bot.sock.groupParticipantsUpdate(ctx.chatId, [target], "promote");
            await ctx.reply(`👑 @${targetNum} is now an Admin.`, { mentions: [target] });
          } catch {
            await ctx.reply("🚫 Failed. Bot must be Admin to promote others.");
          }
          break;

        case "demote":
        case "unadmin":
          try {
            await ctx.bot.sock.groupParticipantsUpdate(ctx.chatId, [target], "demote");
            await ctx.reply(`⬇️ @${targetNum} is no longer an Admin.`, { mentions: [target] });
          } catch {
            await ctx.reply("🚫 Failed. Bot must be Admin to demote others.");
          }
          break;
      }

    } catch (e) {
      ctx.logger.error("ADMIN", `Error: ${e.message}`);
    }
  }
};