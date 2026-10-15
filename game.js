'use strict';

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const ui = Object.fromEntries(['score', 'lives', 'overlay', 'overlay-tag', 'overlay-title', 'overlay-text', 'start', 'pause', 'restart', 'status'].map(id => [id, document.getElementById(id)]));
  const W = canvas.width;
  const H = canvas.height;
  const keys = new Set();
  const stars = Array.from({ length: 85 }, () => ({ x: Math.random() * W, y: Math.random() * H, speed: 20 + Math.random() * 65, size: Math.random() < .8 ? 1 : 2 }));
  const playerSprite = ['000010000', '000121000', '000121000', '001222100', '111232111', '122222221', '110222011', '000101000'];
  const enemySprite = ['110000011', '121000121', '122111221', '012232210', '001222100', '000121000', '000010000'];
  let state = 'ready';
  let score = 0;
  let lives = 3;
  let player;
  let bullets = [];
  let enemies = [];
  let particles = [];
  let spawnTimer = 0;
  let shotTimer = 0;
  let elapsed = 0;
  let flash = 0;
  let lastTime = null;

  function resetPlayer() { player = { x: W / 2 - 18, y: H - 90, w: 36, h: 32, invincible: 0 }; }
  function updateHud() {
    ui.score.textContent = String(score).padStart(6, '0');
    ui.lives.textContent = `${lives} / 3`;
    ui.lives.setAttribute('aria-label', `剩余 ${lives} 条生命`);
  }
  function overlay(tag, title, text, button) {
    ui['overlay-tag'].textContent = tag;
    ui['overlay-title'].textContent = title;
    ui['overlay-text'].textContent = text;
    ui.start.textContent = button;
    ui.overlay.hidden = false;
  }
  function start() {
    score = 0; lives = 3; elapsed = 0; flash = 0;
    bullets = []; enemies = []; particles = [];
    spawnTimer = .6; shotTimer = 0; keys.clear(); resetPlayer();
    state = 'playing'; lastTime = null;
    ui.overlay.hidden = true; ui.pause.disabled = false;
    ui.pause.textContent = '暂停'; ui.status.textContent = '巡航中 · 保持警戒';
    updateHud();
  }
  function pause() {
    if (state === 'playing') {
      state = 'paused'; keys.clear(); ui.pause.textContent = '继续';
      ui.status.textContent = '已暂停';
      overlay('FLIGHT PAUSED', '暂停中', '休息一下，星空会等你。', '继续游戏 ↗');
    } else if (state === 'paused') {
      state = 'playing'; lastTime = null; ui.overlay.hidden = true;
      ui.pause.textContent = '暂停'; ui.status.textContent = '巡航中 · 保持警戒';
    }
  }
  function explode(x, y, color) {
    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 150;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .35 + Math.random() * .4, color: i % 3 ? color : '#fff1ac' });
    }
  }
  function overlaps(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function update(dt) {
    elapsed += dt;
    let dx = Number(keys.has('ArrowRight') || keys.has('KeyD')) - Number(keys.has('ArrowLeft') || keys.has('KeyA'));
    let dy = Number(keys.has('ArrowDown') || keys.has('KeyS')) - Number(keys.has('ArrowUp') || keys.has('KeyW'));
    const length = Math.hypot(dx, dy) || 1;
    player.x = Math.max(0, Math.min(W - player.w, player.x + dx / length * 285 * dt));
    player.y = Math.max(0, Math.min(H - player.h, player.y + dy / length * 285 * dt));
    player.invincible = Math.max(0, player.invincible - dt);
    flash = Math.max(0, flash - dt);
    shotTimer = Math.max(0, shotTimer - dt);
    if (keys.has('Space') && shotTimer === 0) {
      bullets.push({ x: player.x + 16, y: player.y - 12, w: 4, h: 14 });
      shotTimer = .12;
    }
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      enemies.push({ x: Math.random() * (W - 36), y: -32, w: 36, h: 28, speed: 95 + Math.random() * 75 + Math.min(elapsed * 1.4, 110), dead: false });
      spawnTimer = Math.max(.28, .85 - elapsed * .004) + Math.random() * .25;
    }
    for (const bullet of bullets) bullet.y -= 560 * dt;
    for (const enemy of enemies) enemy.y += enemy.speed * dt;
    for (const bullet of bullets) {
      for (const enemy of enemies) {
        if (!enemy.dead && !bullet.dead && overlaps(bullet, enemy)) {
          bullet.dead = true; enemy.dead = true; score += 100;
          explode(enemy.x + 18, enemy.y + 14, '#ff685c'); updateHud();
          break;
        }
      }
    }
    for (const enemy of enemies) {
      if (!enemy.dead && player.invincible === 0 && overlaps(player, enemy)) {
        enemy.dead = true; lives--; player.invincible = 1.6; flash = .16;
        explode(player.x + 18, player.y + 16, '#65cfff');
        explode(enemy.x + 18, enemy.y + 14, '#ff685c'); updateHud();
        if (lives === 0) {
          state = 'over'; keys.clear(); ui.pause.disabled = true;
          ui.status.textContent = '任务结束';
          overlay('MISSION COMPLETE', 'GAME OVER', `最终得分：${score} · 再来一次，突破记录。`, '重新出击 ↗');
          break;
        }
      }
    }
    bullets = bullets.filter(b => !b.dead && b.y + b.h > 0);
    enemies = enemies.filter(e => !e.dead && e.y < H + 40);
  }
  function sprite(rows, x, y, colors) {
    rows.forEach((row, r) => [...row].forEach((pixel, c) => {
      if (pixel !== '0') { ctx.fillStyle = colors[Number(pixel) - 1]; ctx.fillRect(Math.round(x) + c * 4, Math.round(y) + r * 4, 4, 4); }
    }));
  }
  function draw() {
    ctx.fillStyle = '#060b18'; ctx.fillRect(0, 0, W, H);
    for (const star of stars) {
      ctx.fillStyle = star.size === 1 ? '#496581' : '#a6c9e8';
      ctx.fillRect(Math.floor(star.x), Math.floor(star.y), star.size, star.size * 2);
    }
    ctx.strokeStyle = '#142034'; ctx.lineWidth = 1;
    ctx.strokeRect(12.5, 12.5, W - 25, H - 25);
    for (const b of bullets) {
      ctx.fillStyle = '#204c6c'; ctx.fillRect(b.x - 3, b.y, 10, b.h);
      ctx.fillStyle = '#aaf5ff'; ctx.fillRect(b.x, b.y, b.w, b.h);
    }
    for (const e of enemies) sprite(enemySprite, e.x, e.y, ['#b32e4f', '#ff665f', '#ffcf9b']);
    if (state !== 'over' && (player.invincible === 0 || Math.floor(player.invincible * 12) % 2 === 0)) {
      ctx.fillStyle = '#ffb958';
      ctx.fillRect(Math.round(player.x) + 12, Math.round(player.y) + 32, 4, 5 + Math.floor(elapsed * 30) % 8);
      ctx.fillRect(Math.round(player.x) + 20, Math.round(player.y) + 32, 4, 5 + Math.floor(elapsed * 30) % 8);
      sprite(playerSprite, player.x, player.y, ['#2860a4', '#60bcff', '#ddfaff']);
    }
    for (const p of particles) {
      ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), 4, 4);
    }
    ctx.globalAlpha = 1;
    if (flash > 0) { ctx.fillStyle = '#b7eaff44'; ctx.fillRect(0, 0, W, H); }
  }
  function frame(time) {
    const dt = lastTime === null ? 0 : Math.min((time - lastTime) / 1000, .033);
    lastTime = time;
    if (state !== 'paused') {
      for (const s of stars) { s.y += s.speed * dt; if (s.y > H) { s.y = -4; s.x = Math.random() * W; } }
      if (state === 'playing') update(dt);
      for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
      particles = particles.filter(p => p.life > 0);
    }
    draw(); requestAnimationFrame(frame);
  }
  const gameplayKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space']);
  window.addEventListener('keydown', event => {
    if (gameplayKeys.has(event.code)) {
      // Preserve Space activation for focused buttons outside active play.
      if (state === 'playing' || event.target.tagName !== 'BUTTON') event.preventDefault();
      if (state === 'playing') keys.add(event.code);
    }
    if (event.code === 'KeyP' && !event.repeat) pause();
  });
  window.addEventListener('keyup', event => keys.delete(event.code));
  window.addEventListener('blur', () => { keys.clear(); if (state === 'playing') pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') pause(); });
  ui.start.addEventListener('click', () => { state === 'paused' ? pause() : start(); ui.start.blur(); });
  ui.pause.addEventListener('click', () => { pause(); ui.pause.blur(); });
  ui.restart.addEventListener('click', () => { start(); ui.restart.blur(); });
  resetPlayer(); updateHud(); requestAnimationFrame(frame);
})();
