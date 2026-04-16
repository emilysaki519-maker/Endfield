const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  AttachmentBuilder,
} = require("discord.js");

async function sendCharacterImage(message, character) {
  const imgUrl =
    character.images[Math.floor(Math.random() * character.images.length)];
  const ext = imgUrl.split(".").pop().toLowerCase().split("?")[0];
  const fileName = `${character.name.toLowerCase().replace(/\s+/g, "_")}.${ext}`;

  const res = await fetch(imgUrl, { headers: { "User-Agent": "discord-bot" } });
  if (!res.ok) throw new Error(`Không tải được ảnh: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  const attachment = new AttachmentBuilder(buffer, { name: fileName });
  const embed = new EmbedBuilder()
    .setAuthor({
      name: `✦ ${character.name}`,
      iconURL: `attachment://${fileName}`,
    })
    .setDescription(`__✦ ${character.name}__`)
    .setThumbnail(`attachment://${fileName}`)
    .setImage(`attachment://${fileName}`)
    .setColor(0xff0033)
    .setFooter({ text: "Endfield Characters" });

  await message.reply({ embeds: [embed], files: [attachment] });
}

const GITHUB_OWNER = "emilysaki519-maker";
const GITHUB_REPO = "Endfield";
const IMAGES_PATH = "images";
const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedCharacters = [];
let cacheTime = 0;

function generateAliases(folderName) {
  const lower = folderName.toLowerCase().replace(/\s+/g, "");
  const aliases = new Set();
  aliases.add(lower);
  aliases.add(folderName.toLowerCase());
  if (lower.length > 3) aliases.add(lower.slice(0, 3));
  if (lower.length > 4) aliases.add(lower.slice(0, 4));
  return Array.from(aliases);
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": "discord-bot" } });
  if (!res.ok) throw new Error(`GitHub API lỗi ${res.status}: ${url}`);
  return res.json();
}

async function loadCharacters() {
  const now = Date.now();
  if (cachedCharacters.length > 0 && now - cacheTime < CACHE_TTL_MS) {
    return cachedCharacters;
  }

  const apiBase = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents`;
  const dirs = await fetchJson(`${apiBase}/${IMAGES_PATH}`);
  const folders = dirs.filter((d) => d.type === "dir");

  const results = [];
  for (const folder of folders) {
    const files = await fetchJson(`${apiBase}/${IMAGES_PATH}/${folder.name}`);
    const images = files
      .filter(
        (f) =>
          f.type === "file" &&
          f.download_url &&
          /\.(jpg|jpeg|png|gif|webp)$/i.test(f.name),
      )
      .map((f) => f.download_url);

    if (images.length > 0) {
      results.push({
        name: folder.name,
        aliases: generateAliases(folder.name),
        images,
      });
    }
  }

  cachedCharacters = results;
  cacheTime = now;
  console.log(`[Bot] Đã tải ${results.length} nhân vật từ GitHub`);
  return results;
}

async function findCharacter(query) {
  const chars = await loadCharacters();
  const q = query.toLowerCase().trim();
  return (
    chars.find(
      (c) =>
        c.name.toLowerCase() === q ||
        c.aliases.some(
          (alias) =>
            alias.toLowerCase() === q || q.startsWith(alias.toLowerCase()),
        ),
    ) || null
  );
}

async function getAllNames() {
  const chars = await loadCharacters();
  return chars.map((c) => c.name);
}

const NV_PREFIXES = ["!nhân vật ", "!nhan vat ", "!nv "];
const NV_BARE = ["!nhân vật", "!nhan vat", "!nv"];

function parseCommand(content) {
  const lower = content.toLowerCase();
  for (const prefix of NV_PREFIXES) {
    if (lower.startsWith(prefix)) {
      return { cmd: "nv", args: content.slice(prefix.length).trim() };
    }
  }
  for (const bare of NV_BARE) {
    if (lower === bare) return { cmd: "nv", args: "" };
  }
  if (lower === "!list") return { cmd: "list", args: "" };
  if (lower === "!reload") return { cmd: "reload", args: "" };
  if (lower.startsWith("!"))
    return { cmd: "shortcut", args: content.slice(1).trim() };
  return { cmd: "", args: "" };
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("clientReady", () => {
  console.log(`[Bot] Online: ${client.user.tag}`);
  loadCharacters().catch((err) =>
    console.error("[Bot] Lỗi tải nhân vật:", err.message),
  );
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  const content = message.content.trim();
  if (!content.startsWith("!")) return;

  const { cmd, args } = parseCommand(content);

  try {
    if (cmd === "reload") {
      cacheTime = 0;
      cachedCharacters = [];
      const msg = await message.reply(
        "🔄 Đang tải lại danh sách nhân vật từ GitHub...",
      );
      const names = await getAllNames();
      await msg.edit(
        `✅ Đã tải lại! Hiện có **${names.length}** nhân vật: ${names.join(", ")}`,
      );
      return;
    }

    if (cmd === "list") {
      const names = await getAllNames();
      if (names.length === 0) {
        await message.reply(
          "⚠️ Chưa có nhân vật nào. Thêm thư mục ảnh vào GitHub rồi dùng `!reload`.",
        );
        return;
      }
      const embed = new EmbedBuilder()
        .setTitle("📋 Danh sách nhân vật")
        .setDescription(names.map((n) => `• **${n}**`).join("\n"))
        .setColor(0x5865f2)
        .setFooter({
          text: "Dùng !nhân vật [tên] để xem ảnh • !reload để cập nhật",
        });
      await message.reply({ embeds: [embed] });
      return;
    }

    if (cmd === "nv") {
      if (!args) {
        await message.reply(
          "❓ Bạn muốn xem nhân vật nào?\nDùng `!list` để xem danh sách.\n\nVí dụ: `!nhân vật Xaihi`",
        );
        return;
      }
      const character = await findCharacter(args);
      if (!character) {
        await message.reply(
          `❌ Không tìm thấy **${args}**.\nDùng \`!list\` để xem danh sách.`,
        );
        return;
      }
      await sendCharacterImage(message, character);
      return;
    }

    if (cmd === "shortcut" && args.length > 0) {
      const character = await findCharacter(args);
      if (character) {
        await sendCharacterImage(message, character);
      }
    }
  } catch (err) {
    console.error("[Bot] Lỗi:", err.message);
    await message.reply("⚠️ Có lỗi xảy ra, vui lòng thử lại.").catch(() => {});
  }
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("[Bot] Thiếu DISCORD_TOKEN!");
  process.exit(1);
}

client.login(token);
