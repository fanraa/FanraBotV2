export default {
    name: "self-identify",
    cmd: ["myid", "setowner"],
    type: "command",
    priority: 99, // Lowest priority

    run: async (ctx) => {
        const sender = ctx.sender;
        const senderNumber = ctx.senderNumber;
        const userDB = ctx.user || {};

        // --- FORMAT USER INFO CLEAN ---
 if (ctx.command === "myid") {
    const u = ctx.user || {};

    const name = ctx.pushName || u.name || "Unknown";
    const role = u.role || "member";
    const phone = u.phoneNumber || ctx.senderNumber;
    const jid = ctx.sender;
    const tokens = u.tokens ?? 0;
    const interactions = u.interactions ?? 0;

    const createdAt = u.createdAt
        ? new Date(u.createdAt).toLocaleString()
        : "Unknown";
    const lastSeen = u.lastSeen
        ? new Date(u.lastSeen).toLocaleString()
        : "Unknown";

    const anti = u.antilink || {};
    const antiDate = anti.date || "-";
    const antiCount = anti.count ?? 0;

    const groupsJoined = u.groupsJoined ?? 0;
    const prefixUsed = ctx.prefix || ".";

    await ctx.reply(
        `
\`Your Profile Summary\` 
*Name           :* ${name}
*Role              :* ${role}
*Tokens         :* ${tokens}
*Interactions :* ${interactions}

\`Anti-Link Info:\`
*Violations Today :*  *${antiCount}*
*Violation Date     :*  *${antiDate}*
        `.trim()
    );

    return;
}


        // --- OWNER SETTER ---
        if (ctx.command === "setowner") {

            if (userDB && userDB.role === "owner") {
                return ctx.reply(
                    "✨ You are already registered as the *Owner* of this bot."
                );
            }

            // Your real master number (only this number can activate owner mode)
            const MASTER_PHONE_NUMBER = "6285788918217";

            if (senderNumber === MASTER_PHONE_NUMBER) {
                // Update database
                userDB.role = "owner";
                userDB.joinedAt = userDB.joinedAt || new Date().toISOString();
                await ctx.saveUsers();

                return ctx.reply(
                    `
🎉 *Access Granted!*

Your number (${senderNumber}) is now set as the *OFFICIAL OWNER* of this bot.  
Your role has been updated in the database successfully.

Welcome, Boss. 👑
                    `.trim()
                );
            }

            return ctx.reply(
                `
❌ Sorry, only the Master number  
*${MASTER_PHONE_NUMBER}*  
is allowed to activate Owner Mode.
                `.trim()
            );
        }
    }
};
