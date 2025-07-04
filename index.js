require("dotenv").config();
const fs = require("fs");
const express = require("express");
const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
} = require("discord.js");

const app = express();
const PORT = process.env.PORT || 3000;

// Web server để giữ bot sống (Replit/Render)
app.get("/", (req, res) => {
  res.send("✅ Bot đang hoạt động!");
});
app.listen(PORT, () => {
  console.log(`🌐 Web server đang chạy tại cổng ${PORT}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.User],
});

// ==== CẤU HÌNH ====
const VERIFY_CHANNEL_ID = "1389751213771460608"; // Kênh nhận ảnh
const VERIFIED_ROLE_ID = "1343245751177711656";  // Role xác minh
const LOG_CHANNEL_ID = "1389751363617165342";    // Kênh thông báo log

let pending = {};

// ==== BOT ONLINE ====
client.once("ready", () => {
  console.log(`🤖 Bot đã đăng nhập: ${client.user.tag}`);

  (async () => {
    const channel = await client.channels.fetch(VERIFY_CHANNEL_ID);
    pending = fs.existsSync("data.json")
      ? JSON.parse(fs.readFileSync("data.json"))
      : {};

    // Quét lại 50 tin nhắn gần nhất
    const messages = await channel.messages.fetch({ limit: 50 });
    messages.forEach(async (msg) => {
      if (
        msg.attachments.size > 0 &&
        !pending[msg.id] &&
        !msg.author.bot
      ) {
        pending[msg.id] = msg.author.id;
        await msg.react("✅");
        await msg.react("❌");
        console.log(`📦 Phát hiện ảnh cũ từ ${msg.author.tag}`);
      }
    });

    fs.writeFileSync("data.json", JSON.stringify(pending, null, 2));
    console.log(`✅ Quét xong kênh xác minh.`);
  })();

});

// ==== NHẬN ẢNH TỪ USER ====
client.on("messageCreate", async (message) => {
  if (message.channel.id !== VERIFY_CHANNEL_ID || message.author.bot) return;

  if (message.attachments.size > 0) {
    pending[message.id] = message.author.id;
    fs.writeFileSync("data.json", JSON.stringify(pending, null, 2));
    await message.react("✅");
    await message.react("❌");
    console.log(`📸 Nhận ảnh từ ${message.author.tag}`);
  }
});

// ==== PHẢN ỨNG XÁC MINH ====
client.on("messageReactionAdd", async (reaction, user) => {
  try {
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();
    if (user.bot) return;

    const messageId = reaction.message.id;
    const targetUserId = pending[messageId];
    if (!targetUserId) return;

    const guild = reaction.message.guild;
    const memberReacting = await guild.members.fetch(user.id);

    if (!memberReacting.permissions.has(PermissionsBitField.Flags.Administrator)) {
      console.log(`⛔ ${user.tag} không có quyền xác minh.`);
      return;
    }

    const targetMember = await guild.members.fetch(targetUserId);
    const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);

    if (reaction.emoji.name === "✅") {
      await targetMember.roles.add(VERIFIED_ROLE_ID);
      console.log(`✅ Đã cấp role cho ${targetUserId}`);
      if (logChannel) {
        logChannel.send(`✅ **<@${targetUserId}> đã được xác minh bởi <@${user.id}>**`);
      }
    } else if (reaction.emoji.name === "❌") {
      console.log(`❌ Từ chối xác minh ${targetUserId}`);
      if (logChannel) {
        logChannel.send(`❌ **<@${targetUserId}> bị từ chối xác minh bởi <@${user.id}>**`);
      }
    }

    delete pending[messageId];
    fs.writeFileSync("data.json", JSON.stringify(pending, null, 2));
  } catch (err) {
    console.error("❗ Lỗi khi xử lý reaction:", err);
  }
});

client.login(process.env.TOKEN);
