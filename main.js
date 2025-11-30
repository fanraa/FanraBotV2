// main.js
// WhatsApp Bot Runner — Smart Logging & ID Fix
// ============================================
import 'dotenv/config';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import chalk from 'chalk';
import engine from './core/index.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const qrcode = require('qrcode-terminal');
const lib = require('@whiskeysockets/baileys');

// Fungsi aman ambil library baileys
function getBaileysFunction(key) {
  return lib[key] || lib.default?.[key] || lib.default?.default?.[key];
}

const makeWASocket = lib.default?.default || lib.default || lib;
const makeInMemoryStore = getBaileysFunction('makeInMemoryStore');
const useMultiFileAuthState = getBaileysFunction('useMultiFileAuthState');
const DisconnectReason = getBaileysFunction('DisconnectReason');
const fetchLatestBaileysVersion = getBaileysFunction('fetchLatestBaileysVersion');
const jidNormalizedUser = getBaileysFunction('jidNormalizedUser');
const Browsers = getBaileysFunction('Browsers');

const SESSION_DIR = process.env.SESSION_DIR || 'session';
const USE_STORE = true;
const localLogger = pino({ level: 'silent' });

// Store Handler
const store = USE_STORE && makeInMemoryStore ? makeInMemoryStore({ logger: localLogger }) : undefined;
if (store) {
  setInterval(() => {
    try { store.writeToFile('./store.json'); } catch {}
  }, 60_000); 
}

// Message Serializer (Menyederhanakan object pesan)
const serialize = (m, sock) => {
  if (!m) return null;
  const msg = m.messages?.[0];
  if (!msg?.message) return null;
  if (msg.key?.remoteJid === 'status@broadcast') return null;
  
  const key = msg.key;
  const chatId = key.remoteJid;
  const isGroup = chatId.endsWith('@g.us');
  
  // --- FIX PENTING: ID NORMALIZATION ---
  let senderRaw = isGroup ? key.participant : chatId;
  const sender = jidNormalizedUser(senderRaw || ''); 
  const senderNumber = sender.split('@')[0]; 
  
  const type = Object.keys(msg.message).find(k => k !== 'senderKeyDistributionMessage' && k !== 'messageContextInfo');
  let body = '';
  
  if (type === 'conversation') body = msg.message.conversation;
  else if (type === 'extendedTextMessage') body = msg.message.extendedTextMessage.text;
  else if (type === 'imageMessage') body = msg.message.imageMessage.caption;
  else if (type === 'videoMessage') body = msg.message.videoMessage.caption;
  else if (type === 'listResponseMessage') body = msg.message.listResponseMessage.singleSelectReply.selectedRowId;
  else if (type === 'buttonsResponseMessage') body = msg.message.buttonsResponseMessage.selectedButtonId;
  else if (type === 'templateButtonReplyMessage') body = msg.message.templateButtonReplyMessage.selectedId;

  return {
    raw: msg, key, id: key.id, chatId,
    sender: sender,
    senderNumber: senderNumber,
    pushName: msg.pushName || 'User',
    isGroup, fromMe: key.fromMe, type, body: body || ''
  };
};

class WhatsAppClient {
  constructor() { this.sock = null; }

  async start() {
    try {
      const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
      const { version } = await fetchLatestBaileysVersion();

      engine.logger.info('CLIENT', `Starting WhatsApp Client v${version.join('.')}`);

      this.sock = makeWASocket({
        version,
        logger: localLogger,
        printQRInTerminal: false,
        auth: state,
        browser: Browsers.macOS('Desktop'),
        syncFullHistory: false,
        generateHighQualityLinkPreview: true,
      });

      if (store) store.bind(this.sock.ev);
      
      // --- EVENT LISTENERS ---
      this.sock.ev.on('creds.update', saveCreds);
      this.sock.ev.on('connection.update', (u) => this.handleConnection(u));
      this.sock.ev.on('messages.upsert', (m) => this.handleMessages(m));
      
      // [FIX] Tambahkan listener untuk update grup (Welcome/Goodbye/Promote/Demote)
      this.sock.ev.on('group-participants.update', async (update) => {
          await engine.dispatchEvent('group-participants.update', update);
      });

      // [OPSIONAL] Listener jika ada perubahan info grup (nama/deskripsi)
      this.sock.ev.on('groups.update', async (update) => {
          await engine.dispatchEvent('groups.update', update);
      });

    } catch (e) {
      engine.logger.error('CLIENT', 'Start failed:', e.message);
      setTimeout(() => this.start(), 5000);
    }
  }

  async handleConnection({ connection, lastDisconnect, qr }) {
    if (qr) {
      console.clear();
      engine.logger.info('QR', chalk.yellow('Scan QR Code below:'));
      qrcode.generate(qr, { small: true });
    }
    
    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      if (reason === DisconnectReason.loggedOut) {
        engine.logger.error('CONN', chalk.red('Device Logged Out. Please delete session and restart.'));
        process.exit(1);
      } else {
        engine.logger.warn('CONN', chalk.yellow('Connection lost, reconnecting...'));
        this.start();
      }
    } else if (connection === 'open') {
      engine.logger.info('CONN', chalk.green('WhatsApp Connected! 🚀'));
      this.injectToEngine();
    }
  }

  async handleMessages({ messages, type }) {
    if (type !== 'notify') return;
    for (const m of messages) {
      try {
        const meta = serialize({ messages: [m] }, this.sock);
        if (meta) {
          const context = meta.isGroup ? chalk.magenta('GROUP') : chalk.cyan('PRIVATE');
          const sender = chalk.bold(meta.pushName.slice(0, 15));
          const msgPreview = (meta.body || meta.type).slice(0, 40).replace(/\n/g, ' ');
          
          engine.logger.debug('MSG', `${context} | ${sender}: ${msgPreview}`);
          
          await engine.dispatchEvent('message', meta);
        }
      } catch (e) {
        engine.logger.error('MSG', 'Parse error', e.message);
      }
    }
  }

  injectToEngine() {
    engine.mockWA = {
      sock: this.sock,
      reply: async (jid, text, opts = {}) => {
        return this.sock.sendMessage(jid, { text }, { quoted: opts.quoted });
      },
      sendMessage: async (jid, content, opts = {}) => {
        if (content?.image?.url) {
           try {
             const res = await fetch(content.image.url);
             if (res.ok) {
               const buff = Buffer.from(await res.arrayBuffer());
               return this.sock.sendMessage(jid, { image: buff, caption: content.caption }, opts);
             }
           } catch {
             return this.sock.sendMessage(jid, { text: content.image.url }, opts);
           }
        }
        return this.sock.sendMessage(jid, content, opts);
      },
      react: async (jid, emoji, quoted) => {
        return this.sock.sendMessage(jid, { react: { text: emoji, key: quoted?.key } });
      },
      deleteMessage: async (key) => {
        if (!key) return;
        return this.sock.sendMessage(key.remoteJid, { delete: key });
      },
      // Helper untuk group action
      groupParticipantsUpdate: async (jid, participants, action) => {
        return this.sock.groupParticipantsUpdate(jid, participants, action);
      }
    };
  }
}

const client = new WhatsAppClient();
(async () => {
  await engine.start();
  await client.start();
})();