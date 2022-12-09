import { createRequire } from "module";
import { ChatGPTAPI } from "chatgpt";

const require = createRequire(import.meta.url);
const config = require("./config.json");
const { Client, GatewayIntentBits, AttachmentBuilder } = require("discord.js");

var processing = false;
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
  allowedMentions: { parse: [], repliedUser: true },
});

const api = new ChatGPTAPI({
  sessionToken: config.OAISession,
});

const conversation = api.getConversation();

client.on("ready", trueClient => console.log(`${trueClient.user.tag} is ready!`));

client.on("messageCreate", async (message) => {
  if (
    message.author.bot ||
    message.content.includes("@here") ||
    message.content.includes("@everyone") ||
    (config.channelsWhitelist.length > 0 &&
      !config.channelsWhitelist.includes(message.channel.id))
  )
    return false;

  if (message.mentions.has(client.user.id)) {
    if (
      config.usersWhitelist.length > 0 &&
      !config.usersWhitelist.includes(message.author.id)
    ) {
      await message.reply(config.accessMessage);
      return false;
    }

    if (!processing) {
      processing = true;

      const status = await message.reply(config.processingMessage);
      const question = capitalizeFirstLetter(
        message.content.replace("<@" + config.botID + ">", "").trim()
      );

      try {
        await api.ensureAuth();
        message.channel.sendTyping();
        const answer = await conversation.sendMessage(question, {
          timeoutMs: 5 * 60 * 1000,
        });

        let response = answer
        if (answer.length > 2000) response = { embeds: [ { description: answer, color: 0x2f3136 } ] };
        if (answer.length > 4096) {
          const file = new AttachmentBuilder(Buffer.from(answer)).name("response.txt");
          response = { files: [ file ] };
        }
        
        await message.reply(response);
      } catch (e) {
        console.error(e);
        await message.reply(`An error occurred:\n\`\`\`\n${e.message}\`\`\``)
          .catch(console.error);
      } finally {
        status.delete().catch(console.error);
        processing = false;
      }
    } else {
      message.reply(config.waitingMessage);
    }
  }
});

client.on("error", console.error);
client.on("warn", console.warn);

function capitalizeFirstLetter(string) {
  return string[0].toUpperCase() + string.slice(1);
}

client.login(config.discordToken);
