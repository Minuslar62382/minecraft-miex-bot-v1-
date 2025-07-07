const mineflayer = require('mineflayer');
const armorManager = require('mineflayer-armor-manager')(mineflayer);
const collectBlock = require('mineflayer-collectblock').plugin;
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { goals: { GoalNear } } = require('mineflayer-pathfinder');

const bot = mineflayer.createBot({
  host: 'localhost', // Sunucu IP
  port: 25565,       // Sunucu portu
  username: 'Bot'    // Bot ismi
});

bot.loadPlugin(armorManager);
bot.loadPlugin(collectBlock);
bot.loadPlugin(pathfinder);

bot.once('spawn', () => {
  bot.armorManager.equipAll();
  bot.chat('Hazır! #yardım yazarak komutları görebilirsin.');
});

// Otomatik zırh giy
bot.on('spawn', () => {
  bot.armorManager.equipAll();
});

// Mesaj dinle
bot.on('chat', (username, message) => {
  if (username === bot.username) return;

  const args = message.split(' ');
  const command = args[0];

  if (command === '#yardım') {
    bot.chat('Komutlar: #collect <blok> <sayı> | #attack <isim> | #sleep | #drop | #chop <sayı> | #yardım');
  }

  if (command === '#collect') {
    const blockName = args[1];
    const count = parseInt(args[2]);
    if (!blockName || isNaN(count)) {
      bot.chat('Kullanım: #collect <blok> <sayı>');
      return;
    }
    collectBlocks(blockName, count);
  }

  if (command === '#attack') {
    const targetName = args[1];
    attackPlayer(targetName);
  }

  if (command === '#sleep') {
    sleepInBed();
  }

  if (command === '#drop') {
    dropAllItems();
  }

  if (command === '#chop') {
    const count = parseInt(args[1]);
    if (isNaN(count)) {
      bot.chat('Kullanım: #chop <sayı>');
      return;
    }
    chopWood(count);
  }
});

// Belirtilen blokları topla
async function collectBlocks(blockName, count) {
  const mcData = require('minecraft-data')(bot.version);
  const block = mcData.blocksByName[blockName];
  if (!block) {
    bot.chat(`Blok bulunamadı: ${blockName}`);
    return;
  }

  let collected = 0;

  while (collected < count) {
    const targetBlock = bot.findBlock({
      matching: block.id,
      maxDistance: 64
    });

    if (!targetBlock) {
      bot.chat(`Yakında ${blockName} kalmadı.`);
      break;
    }

    bot.chat(`${blockName} toplanıyor (${collected + 1}/${count})...`);

    try {
      await bot.collectBlock.collect(targetBlock);
      collected++;
    } catch (err) {
      bot.chat('Toplama hatası: ' + err.message);
      break;
    }
  }

  bot.chat(`Toplanan ${blockName}: ${collected}`);
}

// Oyuncuya saldır
function attackPlayer(name) {
  const player = bot.players[name];
  if (!player || !player.entity) {
    bot.chat(`${name} bulunamadı.`);
    return;
  }
  bot.chat(`${name} oyuncusuna saldırıyorum.`);
  bot.pvp.attack(player.entity);
}

// Yatakta uyu
function sleepInBed() {
  const bed = bot.findBlock({
    matching: block => bot.isABed(block)
  });
  if (!bed) {
    bot.chat('Yatak bulunamadı.');
    return;
  }
  bot.sleep(bed).then(() => {
    bot.chat('Uyuyor...');
  }).catch(err => {
    bot.chat('Uyuyamadım: ' + err.message);
  });
}

// Tüm itemleri at
function dropAllItems() {
  const items = bot.inventory.items();
  if (items.length === 0) {
    bot.chat('Envanter boş.');
    return;
  }

  bot.chat('Tüm itemler atılıyor...');
  let i = 0;

  function dropNext() {
    if (i >= items.length) return;
    bot.tossStack(items[i], () => {
      i++;
      dropNext();
    });
  }

  dropNext();
}

// Ağaç kes
async function chopWood(count) {
  const mcData = require('minecraft-data')(bot.version);
  const logIds = [
    mcData.blocksByName.oak_log.id,
    mcData.blocksByName.birch_log.id,
    mcData.blocksByName.spruce_log.id
  ];

  let chopped = 0;

  while (chopped < count) {
    const tree = bot.findBlock({
      matching: logIds,
      maxDistance: 64
    });

    if (!tree) {
      bot.chat('Yakında odun kalmadı.');
      break;
    }

    bot.chat(`Ağaç kesiliyor (${chopped + 1}/${count})...`);

    await bot.pathfinder.goto(new GoalNear(tree.position.x, tree.position.y, tree.position.z, 1));
    await bot.dig(tree);
    chopped++;
  }

  bot.chat(`Kesilen toplam ağaç: ${chopped}`);
}

bot.on('error', err => console.log(err));
bot.on('kicked', reason => console.log(reason));
