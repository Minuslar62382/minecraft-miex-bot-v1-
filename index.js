const mineflayer = require('mineflayer');
const armorManager = require('mineflayer-armor-manager');
const collectBlock = require('mineflayer-collectblock').plugin;
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { goals: { GoalNear } } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp').plugin; // <-- EKLENDİ


const bot = mineflayer.createBot({
  host: 'localhost', // Sunucu IP
  port: 62671,       // Sunucu portu
  username: 'Bot'    // Bot ismi
});

bot.loadPlugin(armorManager);
bot.loadPlugin(collectBlock);
bot.loadPlugin(pathfinder);
bot.loadPlugin(pvp);

bot.once('spawn', () => {
  
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
    bot.chat('Komutlar: #collect <blok> <sayı> | #attack <isim> | #sleep | #drop | #chop <sayı> |#follow <isim> | #come | #yardım');
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
    const targetName = args[1]
    if (!targetName) {
      bot.chat('Kullanım: #attack <isim>')
      return
    }
    const player = bot.players[targetName]?.entity
    if (!player) {
      bot.chat(`${targetName} bulunamadı.`)
      return
    }

    bot.chat(`${targetName} oyuncusuna saldırıyorum!`)
    bot.pvp.attack(player)
  }

  if (command === '#stop') {
    bot.pvp.stop()
    bot.pathfinder.setGoal(null)
    bot.chat('Saldırı veya takip durduruldu.')
  }

  if (command === '#come') {
    const player = bot.players[username]?.entity
    if (!player) {
      bot.chat('Seni bulamadım.')
      return
    }

    const mcData = require('minecraft-data')(bot.version)
    const movements = new Movements(bot, mcData)
    bot.pathfinder.setMovements(movements)

    const goal = new GoalNear(player.position.x, player.position.y, player.position.z, 1)
    bot.pathfinder.setGoal(goal)
    bot.chat(`${username}, yanına geliyorum!`)
  }

  if (command === '#follow') {
    const targetName = args[1]
    if (!targetName) {
      bot.chat('Kullanım: #follow <isim>')
      return
    }

    const player = bot.players[targetName]?.entity
    if (!player) {
      bot.chat(`${targetName} bulunamadı.`)
      return
    }

    const mcData = require('minecraft-data')(bot.version)
    const movements = new Movements(bot, mcData)
    bot.pathfinder.setMovements(movements)

    const goal = new GoalFollow(player, 2)
    bot.pathfinder.setGoal(goal, true) // true = sürekli takip et
    bot.chat(`${targetName} oyuncusunu takip ediyorum.`)
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
  bot.chat(`${name} oyuncusuna saldırıyor ve takip ediyorum.`);

  // Takip ve saldırı başlat
  bot.pvp.attack(player.entity);

  // Hedefi sürekli takip et
  const followInterval = setInterval(() => {
    if (!player.entity || !bot.pvp.target) {
      clearInterval(followInterval);
      bot.chat(`${name} artık hedefte değil.`);
      return;
    }
    bot.lookAt(player.entity.position.offset(0, player.entity.height, 0));
  }, 1000);

  // Saldırı bitince intervali temizle
  bot.once('stoppedAttacking', () => {
    clearInterval(followInterval);
    bot.chat(`${name} saldırısı bitti.`);
  });
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

  // Blok isimlerini kontrol et
  const logNames = ['oak_log', 'birch_log', 'spruce_log', 'log', 'log2'];
  const logIds = logNames
    .map(name => mcData.blocksByName[name]?.id)
    .filter(id => id !== undefined);

  if (logIds.length === 0) {
    bot.chat('Odun blokları bu sürümde bulunamadı.');
    return;
  }

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
