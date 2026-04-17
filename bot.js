// bot.js — deploy auf Railway oder Render
import { Client, GatewayIntentBits } from 'discord.js';
import { createClient } from '@supabase/supabase-js';

const bot = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY); // Service Key! nicht anon

const GUILD_ID = '1494736501668446209';

bot.on('messageCreate', async msg => {
  if (msg.guildId !== GUILD_ID) return;

  // !link EMAIL  — verknüpft Discord mit PC Flipper Account
  if (msg.content.startsWith('!link ')) {
    const email = msg.content.slice(6).trim();
    
    // Supabase User per Email suchen (braucht Service Key)
    const { data: users } = await sb.auth.admin.listUsers();
    const user = users.users.find(u => u.email === email);
    
    if (!user) {
      msg.reply('❌ Kein PC Flipper Account mit dieser E-Mail gefunden. Registriere dich zuerst auf der Website.');
      return;
    }
    
    // Prüfen ob Username schon vergeben
    const uname = msg.author.username;
    const { data: existing } = await sb.from('discord_links').select('discord_username').eq('discord_username', uname).maybeSingle();
    if (existing) {
      msg.reply('❌ Dieser Discord-Username ist bereits verknüpft.');
      return;
    }

    // Prüfen ob User schon gelinkt
    const { data: alreadyLinked } = await sb.from('discord_links').select('*').eq('user_id', user.id).maybeSingle();
    if (alreadyLinked) {
      msg.reply('✅ Dein Account ist bereits verknüpft! Du hast Zugang zu allen Features.');
      return;
    }
    
    await sb.from('discord_links').upsert({
      user_id: user.id,
      discord_id: msg.author.id,
      discord_username: uname,
      discord_tag: msg.author.tag,
      is_member: true,
      verified_at: new Date().toISOString()
    });
    
    msg.reply(`✅ Erfolgreich verknüpft! Dein PC Flipper Account (${email}) hat jetzt Zugang zu allen Premium-Features.`);
  }

  // !unlink — trennt die Verknüpfung
  if (msg.content === '!unlink') {
    await sb.from('discord_links').delete().eq('discord_id', msg.author.id);
    msg.reply('✅ Dein Account wurde getrennt.');
  }
  
  // !status — zeigt Verknüpfungsstatus
  if (msg.content === '!status') {
    const { data } = await sb.from('discord_links').select('discord_username, verified_at').eq('discord_id', msg.author.id).maybeSingle();
    if (data) msg.reply(`✅ Verknüpft seit ${new Date(data.verified_at).toLocaleDateString()}`);
    else msg.reply('❌ Nicht verknüpft. Nutze \`!link deine@email.com\`');
  }
});

// Wenn jemand den Server verlässt → is_member auf false setzen
bot.on('guildMemberRemove', async member => {
  if (member.guild.id !== GUILD_ID) return;
  await sb.from('discord_links').update({ is_member: false }).eq('discord_id', member.id);
});

bot.login(process.env.DISCORD_TOKEN);
