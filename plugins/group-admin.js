// plugins/group-admin.js
// 🛡️ Group Admin Tools — Clean English Version
// ============================================

export default {
  name: "group-admin",
  cmd: ["kick", "add", "promote", "demote", "admin", "unadmin"],
  type: "command",
  priority: 2,

  run: async (ctx) => {
    try {
      if (!ctx.isGroup) return ctx.reply("🚫 This command is only available in groups.");

      // --- 1. AUTHENTICATION (DB + REALTIME) ---
      const userDB = ctx.user;
      const isOwner = userDB && userDB.role === "owner";

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

      // Me-target
      if (["me", "myself", "i", "aku", "gue"].includes(firstArg)) {
        if (["kick", "add"].includes(ctx.command)) 
          return ctx.reply("😅 You can't use that on yourself.");
        target = ctx.sender;
      } 
      // Normal targeting
      else {
        const raw = ctx.raw?.message;
        const content = raw?.extendedTextMessage || raw?.imageMessage || raw?.videoMessage || raw?.conversation;
        const context = content?.contextInfo;

        if (context?.mentionedJid?.length > 0) target = context.mentionedJid[0];
        else if (context?.participant) target = context.participant;
        else if (ctx.args.length > 0) {
          let input = ctx.args.join("").replace(/[^0-9]/g, "");
          if (input.startsWith("08")) input = "62" + input.slice(1);
          if (input.length > 5) target = input + "@s.whatsapp.net";
        }
      }

      if (!target) {
        return ctx.reply(
          "⚠️ No target detected.\n" +
          "Please *tag* a user or *reply* to their message."
        );
      }

      // --- 3. ACTIONS ---
      const targetNum = target.split("@")[0];
      const botNum = ctx.bot.sock.user.id.split(":")[0];

      if (targetNum === botNum && ctx.command !== "add") {
        return ctx.reply("🤖 Please don't use admin tools on me.");
      }

      switch (ctx.command) {
        case "kick":
          try {
            await ctx.bot.sock.groupParticipantsUpdate(ctx.chatId, [target], "remove");
            await ctx.reply(`✅ Removed @${targetNum} from the group.`, { mentions: [target] });
          } catch {
            await ctx.reply("🚫 Failed to kick. Make sure the bot is *Admin*.");
          }
          break;

        case "add":
          try {
            const res = await ctx.bot.sock.groupParticipantsUpdate(ctx.chatId, [target], "add");
            const status = res[0]?.status;

            if (status === "200") {
              await ctx.reply(`✨ Added @${targetNum} to the group.`, { mentions: [target] });
            } 
            else if (status === "403") {
              await ctx.reply(`🔐 User's privacy settings blocked the add.\nSending invite link in DM...`);
              const code = await ctx.bot.sock.groupInviteCode(ctx.chatId);
              await ctx.sendMessage(
                { text: `Hey! You've been invited to join the group:\nhttps://chat.whatsapp.com/${code}` },
                { jid: target }
              );
            } 
            else if (status === "409") {
              await ctx.reply("ℹ️ User is already in the group.");
            } 
            else {
              await ctx.reply(`❌ Add failed. (Status: ${status})`);
            }
          } catch {
            await ctx.reply("🚫 Failed to add user. Make sure I'm an *Admin*.");
          }
          break;

        case "promote":
        case "admin":
          try {
            const res = await ctx.bot.sock.groupParticipantsUpdate(ctx.chatId, [target], "promote");
            if (res[0]?.status === "200") {
              if (target === ctx.sender)
                await ctx.reply("👑 You're now an Admin. Power up!");
              else 
                await ctx.reply(`👑 @${targetNum} is now an Admin.`, { mentions: [target] });
            } else {
              await ctx.reply("🚫 Promotion failed. Bot needs admin rights.");
            }
          } catch {
            await ctx.reply("🚫 Failed to promote. Bot isn't an admin.");
          }
          break;

        case "demote":
        case "unadmin":
          try {
            const res = await ctx.bot.sock.groupParticipantsUpdate(ctx.chatId, [target], "demote");
            if (res[0]?.status === "200") {
              if (target === ctx.sender)
                await ctx.reply("⬇️ You're no longer an admin.");
              else
                await ctx.reply(`⬇️ @${targetNum} has been demoted.`, { mentions: [target] });
            } else {
              await ctx.reply("🚫 Demotion failed. Bot needs admin rights.");
            }
          } catch {
            await ctx.reply("🚫 Failed to demote. Bot isn't an admin.");
          }
          break;
      }

    } catch (e) {
      ctx.logger.error("ADMIN", e.message);
    }
  }
};
