import fsPromises from 'fs/promises';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';
import chalk from 'chalk';
import { EventEmitter } from 'events';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

class Logger {
  constructor() {
    this.levels = { debug: 0, info: 1, warn: 2, error: 3 };
    this.level = this.levels.debug; 
    this.logDir = path.join(ROOT, 'logs');

    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  getTime() {
    return new Date().toLocaleTimeString('id-ID', { hour12: false });
  }

  stripAnsi(str) {
    return String(str).replace(/\x1B\[[0-9;]*[mK]/g, '');
  }

  print(level, tag, message) {
    const time = chalk.gray(`[${this.getTime()}]`);
    let tagColor;
    
    switch (level) {
      case 'error': tagColor = chalk.bgRed.bold(` ${tag} `); break;
      case 'warn':  tagColor = chalk.bgYellow.black.bold(` ${tag} `); break;
      case 'info':  tagColor = chalk.bgBlue.bold(` ${tag} `); break;
      case 'debug': tagColor = chalk.bgGreen.black.bold(` ${tag} `); break;
      default:      tagColor = chalk.bgWhite.black(` ${tag} `);
    }

    console.log(`${time} ${tagColor} ${message}`);
    this.writeToFile(level, tag, message);
  }

  writeToFile(level, tag, msg) {
    try {
      const cleanMsg = this.stripAnsi(msg);
      const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] [${tag}] ${cleanMsg}\n`;
      const fileName = `${new Date().toISOString().split('T')[0]}.log`;
      fs.appendFileSync(path.join(this.logDir, fileName), line);
    } catch (e) {}
  }

  info(tag, ...msg) { this.print('info', tag, msg.join(' ')); }
  warn(tag, ...msg) { this.print('warn', tag, msg.join(' ')); }
  error(tag, ...msg) { this.print('error', tag, msg.join(' ')); }
  debug(tag, ...msg) { if (this.level <= 0) this.print('debug', tag, msg.join(' ')); }
}

class ConfigManager {
  constructor() {
    this.botConfigPath = path.join(ROOT, 'config', 'bot.json');
    this.pluginConfigPath = path.join(ROOT, 'config', 'plugins.json');
    this.bot = {};
    this.plugins = {};
  }

  async load() {
    try {
      const botRaw = await fsPromises.readFile(this.botConfigPath, 'utf-8');
      this.bot = JSON.parse(botRaw);
    } catch { this.bot = {}; }

    try {
      const pluginRaw = await fsPromises.readFile(this.pluginConfigPath, 'utf-8');
      this.plugins = JSON.parse(pluginRaw);
    } catch { this.plugins = {}; }
  }

  get(key, defaultValue = null) {
    const keys = key.split('.');
    let current = this.bot;
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) current = current[k];
      else return defaultValue;
    }
    return current ?? defaultValue;
  }
}

class PluginRegistry {
  constructor(logger) {
    this.plugins = new Map();
    this.logger = logger;
  }

  register(pluginObj) {
    if (!pluginObj || typeof pluginObj !== 'object') return false;
    const { name, version = '1.0.0', type = 'utility', priority = 10 } = pluginObj;
    if (!name) return false;

    this.plugins.set(name, { ...pluginObj, version, type, priority, enabled: true });
    this.logger.debug('PLUGIN', `Loaded: ${name} v${version}`);
    return true;
  }

  list() { return Array.from(this.plugins.values()); }
}

export class BotCoreEngine {
  constructor() {
    this.logger = new Logger();
    this.config = new ConfigManager();
    this.registry = new PluginRegistry(this.logger);
    this.eventBus = new EventEmitter();
    
    this.mockWA = {
      reply: async () => {},
      sendMessage: async () => {},
      deleteMessage: async () => {},
      react: async () => {},
      groupParticipantsUpdate: async () => {},
    };

    this.utils = {
      sleep: (ms) => new Promise(r => setTimeout(r, ms)),
      random: (arr) => arr[Math.floor(Math.random() * arr.length)],
    };

    this.usersFile = path.join(ROOT, 'data', 'users.json');
    this.users = new Map();

    this.startFileWatcher();
  }

  async loadUsers() {
    try {
      const raw = await fsPromises.readFile(this.usersFile, 'utf-8');
      const obj = JSON.parse(raw);
      for (const [k, v] of Object.entries(obj)) this.users.set(k, v);
      this.logger.info('DB', `Loaded ${this.users.size} users.`);
    } catch {
      this.users = new Map();
    }
  }

  async saveUsers() {
    try {
      const obj = Object.fromEntries(this.users);
      const str = JSON.stringify(obj, null, 2);
      const tempFile = this.usersFile + '.tmp';
      
      await fsPromises.mkdir(path.dirname(this.usersFile), { recursive: true });
      await fsPromises.writeFile(tempFile, str);
      await fsPromises.rename(tempFile, this.usersFile);
    } catch (err) {
      this.logger.error('DB', 'Failed to save users:', err.message);
    }
  }

  async registerUser(ctx) {
    if (!ctx || !ctx.senderNumber) return;
    const id = ctx.senderNumber;
    const existing = this.users.get(id);
    const now = new Date().toISOString();
    
    // [FIX] Ambil Super Owner dari Environment Variable atau Config
    const SUPER_OWNER = process.env.OWNER_NUMBER || this.config.get('ownerNumber');

    const current = existing || {
      id, 
      phoneNumber: id, 
      name: ctx.pushName || 'User', 
      interactions: 0,
      createdAt: now, 
      lastSeen: now, 
      role: 'member', 
      tokens: 10
    };

    current.interactions++;
    current.lastSeen = now;
    current.name = ctx.pushName || current.name;

    // Logika Role
    if (id === SUPER_OWNER) {
        current.role = 'owner';
    } else if (ctx.fromMe) {
        current.role = 'bot';
    } else {
        const configOwners = this.config.get('owners') || [];
        // Pastikan configOwners berupa array string
        if (Array.isArray(configOwners) && configOwners.includes(id) && current.role !== 'owner') {
             current.role = 'owner';
        }
    }

    this.users.set(id, current);
    // [OPTIMISASI] Jangan save setiap pesan jika traffic tinggi, tapi untuk sekarang aman.
    this.saveUsers().catch(() => {});
    return current;
  }

  buildContext(rawEvent) {
    const defaultJid = rawEvent?.chatId || rawEvent?.sender || null;
    const ctx = {
      ...rawEvent,
      bot: this.mockWA,
      reply: async (text, opts = {}) => {
        try {
          return await this.mockWA.reply(opts.jid || defaultJid, text, { ...opts, quoted: opts.quoted ?? rawEvent.raw });
        } catch (e) { this.logger.error('REPLY', e.message); }
      },
      sendMessage: async (content, opts = {}) => {
        try {
          return await this.mockWA.sendMessage(opts.jid || defaultJid, content, opts);
        } catch (e) { this.logger.error('SEND', e.message); }
      },
      deleteMessage: async (key) => {
        try {
          return await this.mockWA.deleteMessage(key || rawEvent.key);
        } catch(e) { this.logger.error('DELETE', e.message); }
      },
      react: async (emoji) => {
        try {
          return await this.mockWA.react(defaultJid, emoji, rawEvent.raw);
        } catch(e) { this.logger.error('REACT', e.message); }
      },
      config: this.config,
      logger: this.logger,
      utils: this.utils,
      getUser: (id) => this.users.get(id),
      user: this.users.get(rawEvent?.senderNumber), 
      saveUsers: () => this.saveUsers(), 
      listPlugins: () => this.registry.list(),
    };
    return ctx;
  }

  async dispatchEvent(eventName, rawData) {
    // Jika event bukan pesan, rawData mungkin berbeda strukturnya.
    // Kita buat context sederhana jika bukan 'message'
    let ctx;
    if (eventName === 'message') {
        ctx = this.buildContext(rawData);
        try { ctx.user = await this.registerUser(ctx); } catch {}

        const body = (ctx.body || '').trim();
        const isCommand = ['.', '!', '/'].some(p => body.startsWith(p));
      
        if (isCommand) {
            const parts = body.slice(1).trim().split(/\s+/);
            const cmdName = parts[0].toLowerCase();
            ctx.command = cmdName;
            ctx.args = parts.slice(1);
            
            this.logger.info('CMD', `${chalk.bold.yellow(cmdName)} used by ${chalk.cyan(ctx.pushName)}`);

            const plugins = this.registry.list().filter(p => p.enabled && p.type === 'command').sort((a,b) => (a.priority||10)-(b.priority||10));
            let executed = false;
            
            for (const p of plugins) {
                const cmds = Array.isArray(p.cmd) ? p.cmd : [p.cmd];
                if (cmds.includes(cmdName)) {
                    try { 
                        await p.run({ ...ctx, plugin: p }); 
                        executed = true;
                    } 
                    catch (e) { 
                        this.logger.error('PLUGIN', `Error in ${p.name}:`, e.stack || e.message); 
                        ctx.reply(`❌ Error: ${e.message}`);
                    }
                }
            }
            if(!executed) this.logger.debug('CMD', `Unknown command: ${cmdName}`);
        }
    } else {
        // Untuk event non-message (misal: group-participants.update)
        ctx = { 
            ...rawData, 
            bot: this.mockWA, 
            logger: this.logger,
            config: this.config,
            utils: this.utils
        };
    }

    const handlers = this.registry.list().filter(p => p.enabled && p.events?.[eventName]);
    for (const p of handlers) {
        try { await p.events[eventName](ctx); } 
        catch (e) { this.logger.error('EVENT', `Error in ${p.name}:`, e.message); }
    }
  }

  async loadPlugins() {
    const pluginsDir = path.join(ROOT, 'plugins');
    if (!fs.existsSync(pluginsDir)) return;
    
    const getFiles = async (dir) => {
      const dirents = await fsPromises.readdir(dir, { withFileTypes: true });
      const files = await Promise.all(dirents.map((dirent) => {
        const res = path.resolve(dir, dirent.name);
        return dirent.isDirectory() ? getFiles(res) : res;
      }));
      return Array.prototype.concat(...files);
    };

    const files = await getFiles(pluginsDir);
    for (const f of files) {
        if (f.endsWith('.js')) {
            try {
                const module = await import(`file://${f}`);
                const plugin = module.default || module;
                if (plugin?.name) {
                    plugin.filePath = f;
                    
                    if (typeof plugin.load === 'function') {
                        await plugin.load(this.logger);
                    }

                    this.registry.register(plugin);
                }
            } catch (e) {
                this.logger.error('LOAD', `Failed to load ${path.basename(f)}:`, e.message);
            }
        }
    }
  }

  startFileWatcher() {
    this.watcher = chokidar.watch(path.join(ROOT, 'config'), { ignored: /(^|[/\\])\../, persistent: true });
    this.watcher.on('change', async () => {
       await this.config.load();
       this.logger.info('CONFIG', 'Configuration reloaded.');
    });
  }

  async start() {
    console.clear();
    this.logger.info('CORE', chalk.bold.green('Starting FanraBot Engine...'));
    await this.config.load();
    await this.loadUsers();
    await this.loadPlugins();
    this.logger.info('CORE', 'Engine Ready!');
  }
}

const engine = new BotCoreEngine();
export default engine;

if (import.meta.url === `file://${process.argv[1]}`) engine.start();