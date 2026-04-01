/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Stage, Layer, Rect, Circle, Image as KonvaImage, Group, Text, Shape } from 'react-konva';

// ... (rest of imports)

const ItemRenderer = ({ items, camera, playerPos }: { items: any[], camera: any, playerPos: any }) => {
  return (
    <Shape
      sceneFunc={(context, shape) => {
        items.forEach(item => {
          const dx = item.x - playerPos.x;
          const dy = item.y - playerPos.y;
          if (Math.sqrt(dx * dx + dy * dy) > RENDER_DIST) return;

          const x = item.x - camera.x;
          const y = item.y - camera.y;
          const radius = Math.max(0, item.type === 'HEALTH' ? 6 : 4);

          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fillStyle = item.type === 'HEALTH' ? '#e74c3c' : '#3498db';
          context.fill();
        });
      }}
      listening={false}
    />
  );
};

const ProjectileRenderer = ({ projectiles, camera, playerPos }: { projectiles: any[], camera: any, playerPos: any }) => {
  return (
    <Shape
      sceneFunc={(context, shape) => {
        projectiles.forEach(p => {
          const dx = p.x - playerPos.x;
          const dy = p.y - playerPos.y;
          if (Math.sqrt(dx * dx + dy * dy) > RENDER_DIST) return;

          const x = p.x - camera.x;
          const y = p.y - camera.y;
          const radius = Math.max(0, p.type === 'ARROW' ? 3 : 4);

          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fillStyle = p.isMonster ? '#9b59b6' : (p.type === 'ARROW' ? '#f1c40f' : '#ecf0f1');
          context.fill();
        });
      }}
      listening={false}
    />
  );
};

const ParticleRenderer = ({ particles, camera }: { particles: any[], camera: any }) => {
  return (
    <Shape
      sceneFunc={(context, shape) => {
        particles.forEach(p => {
          const x = p.x - camera.x;
          const y = p.y - camera.y;
          const radius = Math.max(0, 2 * p.life);

          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fillStyle = p.color;
          context.globalAlpha = p.life;
          context.fill();
          context.globalAlpha = 1;
        });
      }}
      listening={false}
    />
  );
};

const MonsterRenderer = ({ monsters, camera, playerPos }: { monsters: any[], camera: any, playerPos: any }) => {
  return (
    <Shape
      sceneFunc={(context, shape) => {
        monsters.forEach(m => {
          const dx = m.x - playerPos.x;
          const dy = m.y - playerPos.y;
          if (Math.sqrt(dx * dx + dy * dy) > RENDER_DIST) return;

          const x = m.x - camera.x;
          const y = m.y - camera.y;
          const size = m.size || 1;
          const baseSize = m.type === 'BOSS' ? 120 : MONSTER_SIZE;
          const mSize = baseSize * size;

          context.save();
          context.translate(x, y);
          context.globalAlpha = m.invisible ? 0.2 : 1;

          // Body
          context.beginPath();
          const cornerRadius = (m.type === 'SLIME' || m.type === 'SPLITTER') ? 14 * size : 4 * size;
          
          // Simple rect with corner radius manually if needed, but for performance let's use simple rect or roundedRect
          context.fillStyle = 
            m.type === 'BOSS' ? '#991b1b' : 
            m.type === 'ORC' ? '#1e3a8a' : 
            m.type === 'RANGED' ? '#7c3aed' : 
            m.type === 'CHARGER' ? '#ea580c' : 
            m.type === 'HEALER' ? '#059669' : 
            m.type === 'SUMMONER' ? '#f59e0b' :
            m.type === 'EXPLODER' ? '#f39c12' :
            m.type === 'GHOST' ? '#94a3b8' :
            m.type === 'SPLITTER' ? '#be185d' :
            m.type === 'SHIELDBEARER' ? '#475569' :
            '#166534';
          
          context.fillRect(0, 0, mSize, mSize);
          
          if (m.isCharging || m.isExploding) {
            context.strokeStyle = '#fff';
            context.lineWidth = 3;
            context.strokeRect(0, 0, mSize, mSize);
          } else {
            context.strokeStyle = '#000';
            context.lineWidth = 2;
            context.strokeRect(0, 0, mSize, mSize);
          }

          // Eyes
          context.fillStyle = '#fff';
          const eyeSize = (m.type === 'BOSS' ? 15 : 4) * size;
          const eyeOffset1 = (m.type === 'BOSS' ? 30 : 6) * size;
          const eyeOffset2 = (m.type === 'BOSS' ? 75 : 18) * size;
          const eyeY = (m.type === 'BOSS' ? 30 : 6) * size;
          context.fillRect(eyeOffset1, eyeY, eyeSize, eyeSize);
          context.fillRect(eyeOffset2, eyeY, eyeSize, eyeSize);

          // Health Bar
          context.fillStyle = '#333';
          context.fillRect(0, -10, mSize, 4);
          context.fillStyle = '#e74c3c';
          context.fillRect(0, -10, mSize * (m.health / m.maxHealth), 4);

          // Explosion Warning
          if (m.isExploding) {
            context.beginPath();
            const explosionRadius = Math.max(0, 40 * (1 - (m.explosionTimer || 0) / 60));
            context.arc(mSize / 2, mSize / 2, explosionRadius, 0, Math.PI * 2);
            context.fillStyle = "#f39c12";
            context.globalAlpha = 0.3;
            context.fill();
          }

          context.restore();
        });
      }}
      listening={false}
    />
  );
};
import { motion, AnimatePresence } from 'motion/react';
import { 
  Gamepad2, Keyboard, Move, Info, Sword, Target, Zap, Heart, 
  Trophy, MousePointer2, Skull, RefreshCw, Play, Settings 
} from 'lucide-react';
import confetti from 'canvas-confetti';

// Game Constants
const CHUNK_SIZE = 20;
const TILE_SIZE = 40;
const CHUNK_PIXELS = CHUNK_SIZE * TILE_SIZE;

const PLAYER_SIZE = 32;
const PLAYER_SPEED = 5;
const MONSTER_SIZE = 28;
const MONSTER_SPEED = 1.8;
const PROJECTILE_SPEED = 10;
const MAX_MONSTERS = 40;
const MAX_PARTICLES = 60;
const UPDATE_DIST = 1000;
const RENDER_DIST = 800;
const DESPAWN_DIST = 3000;
const GRID_SIZE = 100;
const INITIAL_WORLD_SEED = Math.floor(Math.random() * 11500)+15200; 

type WeaponType = 'SWORD' | 'BOW' | 'GUN';
type TileType = 'GRASS' | 'WALL' | 'MOUNTAIN' | 'BOSS_FLOOR' | 'WATER' | 'SAFE_ZONE' | 'DESERT' | 'FOREST' | 'OCEAN' | 'SNOW' | 'LAVA' | 'JUNGLE' | 'BEACH' | 'RIVER';

interface Item {
  id: number;
  x: number;
  y: number;
  type: 'HEALTH' | 'XP';
  value: number;
}

interface Position {
  x: number;
  y: number;
}

type MonsterType = 'SLIME' | 'ORC' | 'BOSS' | 'RANGED' | 'CHARGER' | 'HEALER' | 'SUMMONER' | 'EXPLODER' | 'GHOST' | 'SPLITTER' | 'SHIELDBEARER';

interface Monster {
  id: number;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  type: MonsterType;
  stuckTime: number;
  stuckDir: { x: number, y: number } | null;
  lastSkillTime: number;
  isCharging?: boolean;
  chargeDir?: { x: number, y: number };
  invisible?: boolean;
  isExploding?: boolean;
  explosionTimer?: number;
  size?: number; // For splitters
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'ARROW' | 'BULLET' | 'MONSTER_ORB';
  dead?: boolean;
  isMonster?: boolean;
}

interface Chunk {
  tiles: TileType[][];
  canvas: HTMLCanvasElement;
}

export default function App() {
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [playerHealth, setPlayerHealth] = useState(100);
  const [playerStamina, setPlayerStamina] = useState(100);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [upgrades, setUpgrades] = useState<string[]>([]);
  const [stats, setStats] = useState({
    maxHealth: 100,
    maxStamina: 100,
    damage: 1,
    speed: 5,
    attackSpeed: 1,
    range: 1
  });
  const [currentWeapon, setCurrentWeapon] = useState<WeaponType>('SWORD');
  const [bossSpawned, setBossSpawned] = useState(false);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [isMobile, setIsMobile] = useState(false);
  const [joystick, setJoystick] = useState({ active: false, x: 0, y: 0, startX: 0, startY: 0, currentX: 0, currentY: 0, identifier: -1 });
  const [aimJoystick, setAimJoystick] = useState({ active: false, x: 0, y: 0, startX: 0, startY: 0, currentX: 0, currentY: 0, identifier: -1 });

  // Refs for high-performance game state
  const stateRef = useRef({
    playerPos: { x: 0, y: 0 },
    mousePos: { x: 0, y: 0 },
    monsters: [] as Monster[],
    projectiles: [] as Projectile[],
    isAttacking: false,
    attackTimer: 0,
    lastShotTime: 0,
    score: 0,
    xp: 0,
    level: 1,
    playerHealth: 100,
    playerStamina: 100,
    camera: { x: 0, y: 0 },
    bossSpawned: false,
    items: [] as Item[],
    particles: [] as Particle[],
    screenShake: 0,
    keys: {} as { [key: string]: boolean },
    joystick: { x: 0, y: 0 },
    aimJoystick: { x: 0, y: 0, active: false },
  });

  // State for rendering (updated via requestAnimationFrame)
  const [renderState, setRenderState] = useState({
    playerPos: { x: 0, y: 0 },
    monsters: [] as Monster[],
    projectiles: [] as Projectile[],
    items: [] as Item[],
    particles: [] as Particle[],
    camera: { x: 0, y: 0 },
    isAttacking: false,
  });

  const chunksRef = useRef<Map<string, Chunk>>(new Map());

  // Terrain Generation Logic (Deterministic)
  const getNoise = (x: number, y: number, s: number, scale: number = 0.005) => {
    const hash = (px: number, py: number) => {
      let h = Math.imul(px, 374761393) ^ Math.imul(py, 668265263) ^ Math.imul(s, 1274126177);
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      h = (h ^ (h >>> 16));
      return (h >>> 0) / 4294967296;
    };

    const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const noise = (px: number, py: number) => {
      const ix = Math.floor(px);
      const iy = Math.floor(py);
      const fx = px - ix;
      const fy = py - iy;
      const u = fade(fx);
      const v = fade(fy);
      const a = hash(ix, iy);
      const b = hash(ix + 1, iy);
      const c = hash(ix, iy + 1);
      const d = hash(ix + 1, iy + 1);
      return lerp(lerp(a, b, u), lerp(c, d, u), v);
    };

    const qx = noise(x * scale * 0.4 + 1.2, y * scale * 0.4 + 0.8) * 15;
    const qy = noise(x * scale * 0.4 + 5.2, y * scale * 0.4 + 1.3) * 15;
    const rx = noise((x + qx) * scale * 0.3 + 2.4, (y + qy) * scale * 0.3 + 1.7) * 10;
    const ry = noise((x + qx) * scale * 0.3 + 9.1, (y + qy) * scale * 0.3 + 2.8) * 10;
    const nx = (x + rx) * scale;
    const ny = (y + ry) * scale;

    let val = 0;
    let amp = 1;
    let freq = 1;
    let totalAmp = 0;
    for (let i = 0; i < 5; i++) {
      val += noise(nx * freq, ny * freq) * amp;
      totalAmp += amp;
      amp *= 0.5;
      freq *= 2.1;
    }
    return val / totalAmp;
  };

  const getChunk = (cx: number, cy: number): Chunk => {
    const key = `${cx},${cy}`;
    if (chunksRef.current.has(key)) return chunksRef.current.get(key)!;

    const tiles: TileType[][] = [];
    let s = Math.abs((cx * 73856093) ^ (cy * 19349663) ^ INITIAL_WORLD_SEED);
    const seededRandom = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };

    const hasSafeZone = seededRandom() < 0.05;
    const szX = Math.floor(seededRandom() * (CHUNK_SIZE - 6)) + 3;
    const szY = Math.floor(seededRandom() * (CHUNK_SIZE - 6)) + 3;

    for (let y = 0; y < CHUNK_SIZE; y++) {
      tiles[y] = [];
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const worldX = cx * CHUNK_SIZE + x;
        const worldY = cy * CHUNK_SIZE + y;
        if (worldX === 0 && worldY === 0) {
          tiles[y][x] = 'SAFE_ZONE';
          continue;
        }
        const elevation = getNoise(worldX, worldY, INITIAL_WORLD_SEED, 0.002);
        const moisture = getNoise(worldX + 1000, worldY + 1000, INITIAL_WORLD_SEED, 0.002);
        const volcanicNoise = getNoise(worldX - 1000, worldY - 1000, INITIAL_WORLD_SEED, 0.005);
        const riverNoise = getNoise(worldX + 500, worldY - 500, INITIAL_WORLD_SEED + 1, 0.01);
        const jitter = (seededRandom() - 0.5) * 0.03;
        const e = elevation + jitter;
        const m = moisture + jitter;
        
        if (hasSafeZone && Math.abs(x - szX) < 3 && Math.abs(y - szY) < 3) {
          tiles[y][x] = 'SAFE_ZONE';
          continue;
        }

        if (volcanicNoise > 0.92) tiles[y][x] = 'LAVA';
        else if (e < 0.15) tiles[y][x] = 'OCEAN';
        else if (Math.abs(riverNoise - 0.5) < 0.02 && e > 0.22 && e < 0.75) tiles[y][x] = 'RIVER';
        else if (e < 0.22) tiles[y][x] = 'BEACH';
        else if (e > 0.88) tiles[y][x] = 'SNOW';
        else if (e > 0.75) tiles[y][x] = 'MOUNTAIN';
        else {
          if (m < 0.15) tiles[y][x] = 'DESERT';
          else if (m < 0.4) tiles[y][x] = 'GRASS';
          else if (m < 0.7) tiles[y][x] = 'FOREST';
          else tiles[y][x] = 'JUNGLE';
        }

        const walkable = ['GRASS', 'DESERT', 'FOREST', 'JUNGLE', 'BEACH', 'SNOW'];
        if (walkable.includes(tiles[y][x])) {
          const rand = seededRandom();
          if (rand < 0.04) tiles[y][x] = 'WALL';
          else if (rand < 0.06) tiles[y][x] = 'WATER';
        }
      }
    }

    const offCanvas = document.createElement('canvas');
    offCanvas.width = CHUNK_PIXELS;
    offCanvas.height = CHUNK_PIXELS;
    const offCtx = offCanvas.getContext('2d')!;
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const type = tiles[y][x];
        let color = '#166534';
        if (type === 'WALL') color = '#6b7280';
        else if (type === 'MOUNTAIN') color = '#374151';
        else if (type === 'BOSS_FLOOR') color = '#450a0a';
        else if (type === 'WATER') color = '#3b82f6';
        else if (type === 'SAFE_ZONE') color = '#10b981';
        else if (type === 'DESERT') color = '#fef08a';
        else if (type === 'FOREST') color = '#065f46';
        else if (type === 'OCEAN') color = '#1d4ed8';
        else if (type === 'SNOW') color = '#f8fafc';
        else if (type === 'LAVA') color = '#dc2626';
        else if (type === 'JUNGLE') color = '#064e3b';
        else if (type === 'BEACH') color = '#fde047';
        else if (type === 'RIVER') color = '#60a5fa';
        offCtx.fillStyle = color;
        offCtx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }

    const chunk: Chunk = { tiles, canvas: offCanvas };
    if (chunksRef.current.size > 100) {
      const firstKey = chunksRef.current.keys().next().value;
      chunksRef.current.delete(firstKey);
    }
    chunksRef.current.set(key, chunk);
    return chunk;
  };

  const getTileAt = (worldX: number, worldY: number): TileType => {
    const cx = Math.floor(worldX / CHUNK_PIXELS);
    const cy = Math.floor(worldY / CHUNK_PIXELS);
    const chunk = getChunk(cx, cy);
    const tx = Math.floor((worldX % CHUNK_PIXELS + CHUNK_PIXELS) % CHUNK_PIXELS / TILE_SIZE);
    const ty = Math.floor((worldY % CHUNK_PIXELS + CHUNK_PIXELS) % CHUNK_PIXELS / TILE_SIZE);
    return chunk.tiles[ty][tx];
  };

  const createParticles = (x: number, y: number, color: string, count: number) => {
    if (stateRef.current.particles.length >= MAX_PARTICLES) return;
    const actualCount = Math.min(count, MAX_PARTICLES - stateRef.current.particles.length);
    for (let i = 0; i < actualCount; i++) {
      stateRef.current.particles.push({
        id: Math.random(),
        x,
        y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        life: 1.0,
        color,
      });
    }
  };

  // Input Handling
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 1024);
    };
    checkMobile();

    const handleKeyDown = (e: KeyboardEvent) => {
      stateRef.current.keys[e.key.toLowerCase()] = true;
      if (e.key === '1') setCurrentWeapon('SWORD');
      if (e.key === '2') setCurrentWeapon('BOW');
      if (e.key === '3') setCurrentWeapon('GUN');
      if (e.key === ' ' && isGameRunning && !gameOver) handleAttack();
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      stateRef.current.keys[e.key.toLowerCase()] = false;
    };
    const handleResize = () => {
      const width = window.visualViewport ? window.visualViewport.width : window.innerWidth;
      const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      setViewport({ width, height });
      checkMobile();
    };

    const preventZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('resize', handleResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }
    document.addEventListener('touchstart', preventZoom, { passive: false });
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
      document.removeEventListener('touchstart', preventZoom);
    };
  }, [isGameRunning, gameOver]);

  const handleAttack = () => {
    const now = Date.now();
    const { playerPos, mousePos, camera, joystick, aimJoystick } = stateRef.current;
    const playerCenterX = playerPos.x + PLAYER_SIZE / 2;
    const playerCenterY = playerPos.y + PLAYER_SIZE / 2;
    const mouseWorldX = mousePos.x + camera.x;
    const mouseWorldY = mousePos.y + camera.y;
    
    let dx = mouseWorldX - playerCenterX;
    let dy = mouseWorldY - playerCenterY;

    if (isMobile) {
      if (aimJoystick.x !== 0 || aimJoystick.y !== 0) {
        dx = aimJoystick.x;
        dy = aimJoystick.y;
      } else if (joystick.x !== 0 || joystick.y !== 0) {
        dx = joystick.x;
        dy = joystick.y;
      }
    }

    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return;
    const dirX = dx / dist;
    const dirY = dy / dist;

    if (currentWeapon === 'SWORD') {
      const cooldown = 250 / stats.attackSpeed;
      if (!stateRef.current.isAttacking && now - stateRef.current.lastShotTime > cooldown) {
        stateRef.current.isAttacking = true;
        stateRef.current.attackTimer = 12;
        stateRef.current.lastShotTime = now;
      }
    } else {
      const cooldown = (currentWeapon === 'BOW' ? 400 : 120) / stats.attackSpeed;
      if (now - stateRef.current.lastShotTime > cooldown) {
        stateRef.current.lastShotTime = now;
        stateRef.current.projectiles.push({
          id: now,
          x: playerCenterX,
          y: playerCenterY,
          vx: dirX * PROJECTILE_SPEED,
          vy: dirY * PROJECTILE_SPEED,
          type: currentWeapon === 'BOW' ? 'ARROW' : 'BULLET',
        });
      }
    }
  };

  // Game Loop
  useEffect(() => {
    if (!isGameRunning || gameOver) return;

    let animationFrameId: number;
    const update = () => {
      const { keys, playerPos, monsters, projectiles, particles, camera } = stateRef.current;
      
      // Player Movement
      let moveX = 0;
      let moveY = 0;
      const tileAtPlayer = getTileAt(playerPos.x + PLAYER_SIZE / 2, playerPos.y + PLAYER_SIZE / 2);
      
      if (tileAtPlayer === 'SAFE_ZONE') {
        stateRef.current.playerHealth = Math.min(100, stateRef.current.playerHealth + 0.05);
        setPlayerHealth(Math.floor(stateRef.current.playerHealth));
      }
      if (tileAtPlayer === 'LAVA') {
        stateRef.current.playerHealth = Math.max(0, stateRef.current.playerHealth - 0.2);
        setPlayerHealth(Math.floor(stateRef.current.playerHealth));
        if (stateRef.current.playerHealth <= 0) setGameOver(true);
      }

      let speed = stats.speed;
      let dx = 0;
      let dy = 0;
      
      if (keys['w'] || keys['arrowup']) dy -= 1;
      if (keys['s'] || keys['arrowdown']) dy += 1;
      if (keys['a'] || keys['arrowleft']) dx -= 1;
      if (keys['d'] || keys['arrowright']) dx += 1;

      // Joystick input
      if (stateRef.current.joystick.x !== 0 || stateRef.current.joystick.y !== 0) {
        dx = stateRef.current.joystick.x;
        dy = stateRef.current.joystick.y;
      }

      const isSprinting = (keys['shift'] || keys['sprint']) && stateRef.current.playerStamina >= 10 && (dx !== 0 || dy !== 0);
      if (isSprinting) {
        speed *= 1.8;
        stateRef.current.playerStamina = Math.max(0, stateRef.current.playerStamina - 0.5);
      } else {
        stateRef.current.playerStamina = Math.min(stats.maxStamina, stateRef.current.playerStamina + 0.1);
      }
      setPlayerStamina(Math.floor(stateRef.current.playerStamina));

      if (tileAtPlayer === 'OCEAN') speed *= 0.3;
      else if (tileAtPlayer === 'WATER' || tileAtPlayer === 'RIVER') speed *= 0.6;
      else if (tileAtPlayer === 'SNOW') speed *= 0.7;
      else if (tileAtPlayer === 'DESERT') speed *= 0.8;

      if (dx !== 0 || dy !== 0) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        moveX = (dx / dist) * speed;
        moveY = (dy / dist) * speed;
      }

      const checkCollision = (nx: number, ny: number) => {
        const points = [
          { x: nx, y: ny }, { x: nx + PLAYER_SIZE, y: ny },
          { x: nx, y: ny + PLAYER_SIZE }, { x: nx + PLAYER_SIZE, y: ny + PLAYER_SIZE }
        ];
        return points.some(p => {
          const t = getTileAt(p.x, p.y);
          return t === 'WALL' || t === 'MOUNTAIN';
        });
      };

      const nextPos = { ...playerPos };
      if (!checkCollision(playerPos.x + moveX, playerPos.y)) nextPos.x += moveX;
      if (!checkCollision(playerPos.x, playerPos.y + moveY)) nextPos.y += moveY;
      stateRef.current.playerPos = nextPos;

      // Camera
      stateRef.current.camera = {
        x: nextPos.x - viewport.width / 2 + PLAYER_SIZE / 2,
        y: nextPos.y - viewport.height / 2 + PLAYER_SIZE / 2,
      };

      // Attack
      if (isMobile && stateRef.current.aimJoystick.active) {
        handleAttack();
      }

      if (stateRef.current.isAttacking) {
        stateRef.current.attackTimer--;
        if (stateRef.current.attackTimer <= 0) stateRef.current.isAttacking = false;
      }

      // Projectiles
      stateRef.current.projectiles = projectiles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        const t = getTileAt(p.x, p.y);
        if (t === 'WALL' || t === 'MOUNTAIN') return false;
        if (p.isMonster) {
          const dist = Math.sqrt((p.x - (playerPos.x + PLAYER_SIZE / 2)) ** 2 + (p.y - (playerPos.y + PLAYER_SIZE / 2)) ** 2);
          if (dist < PLAYER_SIZE / 2 + 5) {
            stateRef.current.playerHealth -= 5;
            stateRef.current.screenShake = 5;
            setPlayerHealth(Math.max(0, Math.floor(stateRef.current.playerHealth)));
            if (stateRef.current.playerHealth <= 0) setGameOver(true);
            return false;
          }
        }
        return Math.sqrt((p.x - playerPos.x) ** 2 + (p.y - playerPos.y) ** 2) < 1000;
      });

      // Items
      stateRef.current.items = stateRef.current.items.filter(item => {
        const dx = playerPos.x - item.x;
        const dy = playerPos.y - item.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 30) {
          if (item.type === 'HEALTH') {
            stateRef.current.playerHealth = Math.min(stats.maxHealth, stateRef.current.playerHealth + item.value);
            setPlayerHealth(stateRef.current.playerHealth);
          } else if (item.type === 'XP') {
            stateRef.current.xp += item.value;
            if (stateRef.current.xp >= stateRef.current.level * 100) {
              stateRef.current.xp -= stateRef.current.level * 100;
              stateRef.current.level++;
              setLevel(stateRef.current.level);
              
              // Level up logic
              const possibleUpgrades = [
                'Increase Max Health',
                'Increase Max Stamina',
                'Increase Damage',
                'Increase Speed',
                'Increase Attack Speed',
                'Increase Attack Range'
              ];
              const selected = [];
              const pool = [...possibleUpgrades];
              for (let i = 0; i < 3; i++) {
                const idx = Math.floor(Math.random() * pool.length);
                selected.push(pool.splice(idx, 1)[0]);
              }
              setUpgrades(selected);
              setShowLevelUp(true);
              setIsGameRunning(false);
            }
            setXp(stateRef.current.xp);
          }
          return false;
        }
        
        // Magnet effect
        if (dist < 150) {
          item.x += (dx / dist) * 4;
          item.y += (dy / dist) * 4;
        }
        
        return true;
      });

      // Monsters
      const playerProjectiles = stateRef.current.projectiles.filter(p => !p.isMonster && !p.dead);
      
      // Build spatial grid for monsters
      const monsterGrid: Record<string, any[]> = {};
      stateRef.current.monsters.forEach(m => {
        const gx = Math.floor(m.x / GRID_SIZE);
        const gy = Math.floor(m.y / GRID_SIZE);
        const key = `${gx},${gy}`;
        if (!monsterGrid[key]) monsterGrid[key] = [];
        monsterGrid[key].push(m);
      });

      stateRef.current.monsters.forEach(m => {
        const dx = playerPos.x - m.x;
        const dy = playerPos.y - m.y;
        const distSq = dx * dx + dy * dy;
        
        // Culling: Skip update for far-away monsters (1000^2 = 1,000,000)
        if (distSq > 1000000) return;
        const dist = Math.sqrt(distSq);

        let mSpeed = MONSTER_SPEED;
        if (m.type === 'BOSS') mSpeed *= 0.7;
        if (m.type === 'CHARGER' && m.isCharging) mSpeed *= 4;
        if (m.type === 'HEALER') mSpeed *= 1.2;
        if (m.type === 'SLIME') mSpeed *= 0.8;

        // Monster AI & Skills
        const now = Date.now();
        
        if (m.type === 'RANGED') {
          if (dist < 400 && now - m.lastSkillTime > 2000) {
            m.lastSkillTime = now;
            const angle = Math.atan2(dy, dx);
            stateRef.current.projectiles.push({
              id: Math.random(),
              x: m.x + MONSTER_SIZE / 2,
              y: m.y + MONSTER_SIZE / 2,
              vx: Math.cos(angle) * 5,
              vy: Math.sin(angle) * 5,
              type: 'MONSTER_ORB',
              isMonster: true
            });
          }
          // RANGED movement: stay at distance
          if (dist < 250) {
            mSpeed *= -1; // Move away
          } else if (dist < 350) {
            mSpeed = 0; // Stand still to shoot
          }
        } else if (m.type === 'CHARGER') {
          if (!m.isCharging && dist < 300 && now - m.lastSkillTime > 4000) {
            m.isCharging = true;
            m.lastSkillTime = now;
            const angle = Math.atan2(dy, dx);
            m.chargeDir = { x: Math.cos(angle), y: Math.sin(angle) };
            setTimeout(() => {
              m.isCharging = false;
            }, 800);
          }
        } else if (m.type === 'HEALER') {
          // Heal nearby monsters using spatial grid
          const gx = Math.floor(m.x / GRID_SIZE);
          const gy = Math.floor(m.y / GRID_SIZE);
          for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
              const key = `${gx + i},${gy + j}`;
              const cell = monsterGrid[key];
              if (cell) {
                cell.forEach(other => {
                  if (other.id !== m.id && other.health < other.maxHealth) {
                    const dSq = (other.x - m.x) ** 2 + (other.y - m.y) ** 2;
                    if (dSq < 40000) { // 200^2
                      other.health = Math.min(other.maxHealth, other.health + 0.2);
                      if (Math.random() < 0.05) createParticles(other.x + MONSTER_SIZE/2, other.y + MONSTER_SIZE/2, '#2ecc71', 1);
                    }
                  }
                });
              }
            }
          }
          // Stay away from player
          if (dist < 250) mSpeed *= -1;
        } else if (m.type === 'SUMMONER') {
          if (distSq < 250000 && now - m.lastSkillTime > 8000) { // 500^2
            m.lastSkillTime = now;
            for (let i = 0; i < 3; i++) {
              const angle = Math.random() * Math.PI * 2;
              stateRef.current.monsters.push({
                id: Math.random(),
                x: m.x + Math.cos(angle) * 50,
                y: m.y + Math.sin(angle) * 50,
                health: 30,
                maxHealth: 30,
                type: 'SLIME',
                stuckTime: 0,
                stuckDir: null,
                lastSkillTime: now
              });
            }
            createParticles(m.x + MONSTER_SIZE/2, m.y + MONSTER_SIZE/2, '#f1c40f', 10);
          }
          if (dist < 300) mSpeed *= -1;
        } else if (m.type === 'EXPLODER') {
          mSpeed *= 1.5; // Fast
          if (distSq < 3600 && !m.isExploding) { // 60^2
            m.isExploding = true;
            m.explosionTimer = 60; // 1 second at 60fps
          }
          if (m.isExploding) {
            mSpeed = 0;
            m.explosionTimer!--;
            if (m.explosionTimer! <= 0) {
              m.health = 0; // Trigger death/explosion
              // Damage player if close
              if (distSq < 10000) { // 100^2
                stateRef.current.playerHealth -= 20;
                stateRef.current.screenShake = 15;
                setPlayerHealth(Math.max(0, Math.floor(stateRef.current.playerHealth)));
              }
              createParticles(m.x, m.y, '#f39c12', 20);
            }
          }
        } else if (m.type === 'GHOST') {
          if (now - m.lastSkillTime > 3000) {
            m.lastSkillTime = now;
            m.invisible = !m.invisible;
          }
          if (m.invisible) mSpeed *= 0.5;
        } else if (m.type === 'SHIELDBEARER') {
          mSpeed *= 0.6; // Slow
        } else if (m.type === 'BOSS') {
          // Boss Skills
          const timeSinceLastSkill = now - m.lastSkillTime;
          
          if (timeSinceLastSkill > 3000) {
            m.lastSkillTime = now;
            
            // Randomly choose a skill
            const skillRand = Math.random();
            
            if (skillRand < 0.4) {
              // Skill 1: Radial burst
              for (let i = 0; i < 12; i++) {
                const angle = (i / 12) * Math.PI * 2;
                stateRef.current.projectiles.push({
                  id: Math.random(),
                  x: m.x + 60,
                  y: m.y + 60,
                  vx: Math.cos(angle) * 5,
                  vy: Math.sin(angle) * 5,
                  type: 'MONSTER_ORB',
                  isMonster: true
                });
              }
            } else if (skillRand < 0.7) {
              // Skill 2: Summoning
              for (let i = 0; i < 5; i++) {
                const angle = Math.random() * Math.PI * 2;
                stateRef.current.monsters.push({
                  id: Math.random(),
                  x: m.x + Math.cos(angle) * 100,
                  y: m.y + Math.sin(angle) * 100,
                  health: 50,
                  maxHealth: 50,
                  type: 'ORC',
                  stuckTime: 0,
                  stuckDir: null,
                  lastSkillTime: now
                });
              }
              createParticles(m.x + 60, m.y + 60, '#991b1b', 15);
            } else {
              // Skill 3: Charge at player
              m.isCharging = true;
              const angle = Math.atan2(dy, dx);
              m.chargeDir = { x: Math.cos(angle), y: Math.sin(angle) };
              setTimeout(() => {
                m.isCharging = false;
              }, 1500);
            }
          }
          
          if (m.isCharging) mSpeed *= 3;
        }

        // Apply Movement
        if (dist > 5 || ((m.type === 'CHARGER' || m.type === 'BOSS') && m.isCharging)) {
          let mvX, mvY;
          if ((m.type === 'CHARGER' || m.type === 'BOSS') && m.isCharging && m.chargeDir) {
            mvX = m.chargeDir.x * mSpeed;
            mvY = m.chargeDir.y * mSpeed;
          } else {
            mvX = (dx / dist) * mSpeed;
            mvY = (dy / dist) * mSpeed;
          }

          const mSize = m.type === 'BOSS' ? 120 : MONSTER_SIZE;
          const canX = !['WALL', 'MOUNTAIN'].includes(getTileAt(m.x + mvX + mSize / 2, m.y + mSize / 2));
          const canY = !['WALL', 'MOUNTAIN'].includes(getTileAt(m.x + mSize / 2, m.y + mvY + mSize / 2));
          
          if (canX) m.x += mvX;
          if (canY) m.y += mvY;
        }

        // Damage Player
        const collisionDist = (m.type === 'BOSS' ? 80 : PLAYER_SIZE) * (m.size || 1);
        if (dist < collisionDist && !m.invisible) {
          const damage = m.type === 'BOSS' ? 2 : (m.type === 'CHARGER' && m.isCharging ? 1.5 : 0.5);
          stateRef.current.playerHealth -= damage;
          if (m.type === 'BOSS') stateRef.current.screenShake = Math.max(stateRef.current.screenShake, 5);
          setPlayerHealth(Math.max(0, Math.floor(stateRef.current.playerHealth)));
          if (stateRef.current.playerHealth <= 0) setGameOver(true);
        }

        // Monster Combat (Sword)
        if (stateRef.current.isAttacking && currentWeapon === 'SWORD') {
          const mSize = (m.type === 'BOSS' ? 120 : MONSTER_SIZE) * (m.size || 1);
          const mCenterX = m.x + mSize / 2;
          const mCenterY = m.y + mSize / 2;
          const pCenterX = playerPos.x + PLAYER_SIZE / 2;
          const pCenterY = playerPos.y + PLAYER_SIZE / 2;
          const distToP = Math.sqrt((mCenterX - pCenterX) ** 2 + (mCenterY - pCenterY) ** 2);
          if (distToP < 80 * stats.range + mSize / 2) {
            m.health -= 5 * stats.damage;
            createParticles(mCenterX, mCenterY, '#e74c3c', 2);
          }
        }
      });

      // Projectile-Monster Collision using Spatial Grid
      playerProjectiles.forEach(p => {
        if (p.dead) return;
        const gx = Math.floor(p.x / GRID_SIZE);
        const gy = Math.floor(p.y / GRID_SIZE);
        for (let i = -1; i <= 1; i++) {
          for (let j = -1; j <= 1; j++) {
            const key = `${gx + i},${gy + j}`;
            const cell = monsterGrid[key];
            if (cell) {
              for (const m of cell) {
                if (p.dead) break;
                const baseSize = m.type === 'BOSS' ? 120 : MONSTER_SIZE;
                const mSize = baseSize * (m.size || 1);
                const mCenterX = m.x + mSize / 2;
                const mCenterY = m.y + mSize / 2;
                const distToProjSq = (p.x - mCenterX) ** 2 + (p.y - mCenterY) ** 2;
                const collisionDist = mSize / 2 + 5;
                if (distToProjSq < collisionDist * collisionDist) {
                  let damage = (p.type === 'ARROW' ? 15 : 10) * stats.damage;
                  if (m.type === 'SHIELDBEARER') damage *= 0.5;
                  m.health -= damage;
                  p.dead = true;
                  createParticles(p.x, p.y, m.type === 'SHIELDBEARER' ? '#94a3b8' : '#e74c3c', 3);
                }
              }
            }
          }
        }
      });

      // Death & XP & Despawning
      stateRef.current.monsters = stateRef.current.monsters.filter(m => {
        const dx = m.x - playerPos.x;
        const dy = m.y - playerPos.y;
        const distSq = dx * dx + dy * dy;

        // Despawn if too far (3x frame roughly)
        if (distSq > DESPAWN_DIST * DESPAWN_DIST) {
          if (m.type === 'BOSS') {
            stateRef.current.bossSpawned = false;
            setBossSpawned(false);
          }
          return false;
        }

        if (m.health <= 0) {
          // Splitting logic
          if (m.type === 'SPLITTER' && (m.size || 1) > 0.5) {
            const newSize = (m.size || 1) * 0.6;
            for (let i = 0; i < 2; i++) {
              stateRef.current.monsters.push({
                id: Math.random(),
                x: m.x + (Math.random() - 0.5) * 20,
                y: m.y + (Math.random() - 0.5) * 20,
                health: 20,
                maxHealth: 20,
                type: 'SPLITTER',
                size: newSize,
                stuckTime: 0,
                stuckDir: null,
                lastSkillTime: Date.now()
              });
            }
          }
          const scoreGain = m.type === 'BOSS' ? 1000 : 10;
          stateRef.current.score += scoreGain;
          setScore(stateRef.current.score);

          // Drop XP
          stateRef.current.items.push({
            id: Math.random(),
            x: m.x + (m.type === 'BOSS' ? 60 : MONSTER_SIZE / 2),
            y: m.y + (m.type === 'BOSS' ? 60 : MONSTER_SIZE / 2),
            type: 'XP',
            value: m.type === 'BOSS' ? 500 : (m.type === 'SPLITTER' ? 10 : 25)
          });

          // Rare Health drop
          if (Math.random() < 0.1 || m.type === 'BOSS') {
            stateRef.current.items.push({
              id: Math.random(),
              x: m.x,
              y: m.y,
              type: 'HEALTH',
              value: 20
            });
          }

          if (m.type === 'BOSS') {
            stateRef.current.bossSpawned = false;
            setBossSpawned(false);
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
          }
          return false;
        }
        return true;
      });

      // Level Up (already handled in items collection)

      // Particles
      stateRef.current.particles = particles.filter(p => {
        p.x += p.vx; p.y += p.vy; p.life -= 0.02;
        return p.life > 0;
      });

      // Update Render State
      setRenderState({
        playerPos: { ...stateRef.current.playerPos },
        monsters: [...stateRef.current.monsters],
        projectiles: [...stateRef.current.projectiles],
        items: [...stateRef.current.items],
        particles: [...stateRef.current.particles],
        camera: { ...stateRef.current.camera },
        isAttacking: stateRef.current.isAttacking,
      });

      animationFrameId = requestAnimationFrame(update);
    };
    animationFrameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isGameRunning, gameOver, viewport, currentWeapon]);

  // Spawning Logic
  useEffect(() => {
    if (!isGameRunning || gameOver) return;
    const spawnTimer = setInterval(() => {
      const { playerPos, monsters } = stateRef.current;
      if (monsters.length < MAX_MONSTERS) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 600;
        const x = playerPos.x + Math.cos(angle) * dist;
        const y = playerPos.y + Math.sin(angle) * dist;
        const tile = getTileAt(x, y);
        if (['GRASS', 'FOREST', 'JUNGLE', 'DESERT'].includes(tile)) {
          const rand = Math.random();
          let type: MonsterType = 'SLIME';
          let health = 30;
          
          if (stateRef.current.level >= 12 && rand < 0.05) {
            type = 'SHIELDBEARER';
            health = 200;
          } else if (stateRef.current.level >= 10 && rand < 0.1) {
            type = 'GHOST';
            health = 50;
          } else if (stateRef.current.level >= 8 && rand < 0.1) {
            type = 'EXPLODER';
            health = 30;
          } else if (stateRef.current.level >= 6 && rand < 0.15) {
            type = 'SPLITTER';
            health = 80;
          } else if (stateRef.current.level >= 7 && rand < 0.2) {
            type = 'SUMMONER';
            health = 100;
          } else if (stateRef.current.level >= 5 && rand < 0.3) {
            type = 'HEALER';
            health = 50;
          } else if (stateRef.current.level >= 3 && rand < 0.45) {
            type = 'CHARGER';
            health = 60;
          } else if (stateRef.current.level >= 2 && rand < 0.6) {
            type = 'RANGED';
            health = 40;
          } else if (rand < 0.8) {
            type = 'ORC';
            health = 80;
          }

          stateRef.current.monsters.push({
            id: Math.random(), x, y, health, maxHealth: health, type,
            stuckTime: 0, stuckDir: null, lastSkillTime: Date.now()
          });
        }
      }
    }, 2000);
    return () => clearInterval(spawnTimer);
  }, [isGameRunning, gameOver]);

  // Boss Spawn
  useEffect(() => {
    if (!isGameRunning || gameOver || stateRef.current.bossSpawned) return;
    const bossTimer = setInterval(() => {
      if (stateRef.current.score > 0 && stateRef.current.score % 2000 < 100 && !stateRef.current.bossSpawned) {
        stateRef.current.bossSpawned = true;
        setBossSpawned(true);
        const angle = Math.random() * Math.PI * 2;
        const x = stateRef.current.playerPos.x + Math.cos(angle) * 700;
        const y = stateRef.current.playerPos.y + Math.sin(angle) * 700;
        stateRef.current.monsters.push({
          id: 999, x, y, health: 3000, maxHealth: 3000, type: 'BOSS',
          stuckTime: 0, stuckDir: null, lastSkillTime: Date.now()
        });
      }
    }, 5000);
    return () => clearInterval(bossTimer);
  }, [isGameRunning, gameOver]);

  const visibleChunks = useMemo(() => {
    const chunks = [];
    const startCX = Math.floor(renderState.camera.x / CHUNK_PIXELS);
    const startCY = Math.floor(renderState.camera.y / CHUNK_PIXELS);
    const endCX = Math.floor((renderState.camera.x + viewport.width) / CHUNK_PIXELS);
    const endCY = Math.floor((renderState.camera.y + viewport.height) / CHUNK_PIXELS);

    for (let cx = startCX; cx <= endCX; cx++) {
      for (let cy = startCY; cy <= endCY; cy++) {
        chunks.push({ cx, cy, chunk: getChunk(cx, cy) });
      }
    }
    return chunks;
  }, [renderState.camera, viewport]);

  const startGame = () => {
    setIsGameRunning(true);
    setGameOver(false);
    setPlayerHealth(100);
    setScore(0);
    setLevel(1);
    setXp(0);
    setShowLevelUp(false);
    setStats({
      maxHealth: 100,
      maxStamina: 100,
      damage: 1,
      speed: 5,
      attackSpeed: 1,
      range: 1
    });
    setJoystick({ active: false, x: 0, y: 0, startX: 0, startY: 0, currentX: 0, currentY: 0, identifier: -1 });
    setAimJoystick({ active: false, x: 0, y: 0, startX: 0, startY: 0, currentX: 0, currentY: 0, identifier: -1 });
    stateRef.current = {
      ...stateRef.current,
      playerPos: { x: 0, y: 0 },
      monsters: [],
      projectiles: [],
      items: [],
      particles: [],
      playerHealth: 100,
      playerStamina: 100,
      score: 0,
      xp: 0,
      level: 1,
      bossSpawned: false,
      joystick: { x: 0, y: 0 },
      aimJoystick: { x: 0, y: 0, active: false },
    };
    setPlayerStamina(100);
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans text-white">
      {/* Game Stage */}
      <Stage 
        width={viewport.width} 
        height={viewport.height}
        onMouseMove={(e) => {
          const stage = e.target.getStage();
          if (stage) {
            const pos = stage.getPointerPosition();
            if (pos) stateRef.current.mousePos = pos;
          }
        }}
        onMouseDown={handleAttack}
        style={{ touchAction: 'none' }}
      >
        <Layer>
          {/* Terrain */}
          {visibleChunks.map(({ cx, cy, chunk }) => (
            <KonvaImage
              key={`${cx},${cy}`}
              image={chunk.canvas}
              x={cx * CHUNK_PIXELS - renderState.camera.x}
              y={cy * CHUNK_PIXELS - renderState.camera.y}
              width={CHUNK_PIXELS}
              height={CHUNK_PIXELS}
            />
          ))}

          {/* Items */}
          <ItemRenderer 
            items={renderState.items} 
            camera={renderState.camera} 
            playerPos={renderState.playerPos} 
          />

          {/* Monsters */}
          <MonsterRenderer 
            monsters={renderState.monsters} 
            camera={renderState.camera} 
            playerPos={renderState.playerPos} 
          />

          {/* Projectiles */}
          <ProjectileRenderer 
            projectiles={renderState.projectiles} 
            camera={renderState.camera} 
            playerPos={renderState.playerPos} 
          />

          {/* Particles */}
          <ParticleRenderer 
            particles={renderState.particles} 
            camera={renderState.camera} 
          />

          {/* Player */}
          <Group x={renderState.playerPos.x - renderState.camera.x} y={renderState.playerPos.y - renderState.camera.y}>
            <Rect
              width={PLAYER_SIZE}
              height={PLAYER_SIZE}
              fill="#3b82f6"
              cornerRadius={6}
              stroke="#fff"
              strokeWidth={2}
              shadowBlur={renderState.isAttacking ? 15 : 0}
              shadowColor="#3b82f6"
            />
            {/* Sword Swing Visual */}
            {renderState.isAttacking && currentWeapon === 'SWORD' && (
              <Rect
                x={PLAYER_SIZE / 2}
                y={PLAYER_SIZE / 2}
                width={60}
                height={10}
                fill="#fff"
                opacity={0.6}
                rotation={(() => {
                  const { playerPos, mousePos, camera, joystick, aimJoystick } = stateRef.current;
                  const playerCenterX = playerPos.x + PLAYER_SIZE / 2;
                  const playerCenterY = playerPos.y + PLAYER_SIZE / 2;
                  let dx = mousePos.x + camera.x - playerCenterX;
                  let dy = mousePos.y + camera.y - playerCenterY;
                  if (isMobile) {
                    if (aimJoystick.x !== 0 || aimJoystick.y !== 0) {
                      dx = aimJoystick.x;
                      dy = aimJoystick.y;
                    } else if (joystick.x !== 0 || joystick.y !== 0) {
                      dx = joystick.x;
                      dy = joystick.y;
                    }
                  }
                  return Math.atan2(dy, dx) * 180 / Math.PI;
                })()}
                offsetY={5}
              />
            )}
          </Group>
        </Layer>
      </Stage>

      {/* UI Overlay */}
      <div className="absolute top-0 left-0 w-full p-6 pointer-events-none flex justify-between items-start">
        <div className="flex flex-col gap-4">
          {/* Health Bar */}
          <div className="relative w-64 h-6 bg-gray-900/80 rounded-full border-2 border-white/20 overflow-hidden backdrop-blur-md">
            <motion.div 
              className="h-full bg-gradient-to-r from-red-600 to-red-400"
              initial={{ width: '100%' }}
              animate={{ width: `${(playerHealth / stats.maxHealth) * 100}%` }}
              transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
            />
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-white">
              <Heart className="w-3 h-3 mr-1 fill-white" /> {Math.ceil(playerHealth)} HP
            </div>
          </div>

          {/* Stamina Bar */}
          <div className="relative w-48 h-3 bg-gray-900/80 rounded-full border border-white/10 overflow-hidden backdrop-blur-md">
            <motion.div 
              className={`h-full bg-gradient-to-r ${playerStamina < 10 ? 'from-red-500 to-red-400' : 'from-yellow-500 to-yellow-300'}`}
              initial={{ width: '100%' }}
              animate={{ width: `${(playerStamina / stats.maxStamina) * 100}%` }}
              transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
            />
            <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold uppercase tracking-widest text-white/80">
              <Zap className={`w-2 h-2 mr-1 ${playerStamina < 10 ? 'fill-red-500' : 'fill-white'}`} /> {Math.ceil(playerStamina)} STAMINA
            </div>
          </div>

          {/* XP Bar */}
          <div className="w-64 h-3 bg-gray-900/80 rounded-full border border-white/10 overflow-hidden backdrop-blur-md">
            <motion.div 
              className="h-full bg-gradient-to-r from-blue-600 to-cyan-400"
              animate={{ width: `${(xp / (level * 100)) * 100}%` }}
            />
          </div>

          <div className="flex items-center gap-4 text-sm font-mono">
            <div className="bg-black/60 px-3 py-1 rounded border border-white/10 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <span>{score.toLocaleString()}</span>
            </div>
            <div className="bg-black/60 px-3 py-1 rounded border border-white/10">
              LVL {level}
            </div>
          </div>
        </div>

        {/* Weapon Selector */}
        <div className={`flex gap-2 pointer-events-auto ${isMobile ? 'scale-125 origin-top-right' : ''}`}>
          {(['SWORD', 'BOW', 'GUN'] as WeaponType[]).map((w, i) => (
            <button
              key={w}
              onClick={() => setCurrentWeapon(w)}
              className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center transition-all ${
                currentWeapon === w 
                ? 'bg-blue-600 border-white scale-110 shadow-lg shadow-blue-500/50' 
                : 'bg-black/60 border-white/20 hover:border-white/50'
              }`}
            >
              {w === 'SWORD' && <Sword className="w-6 h-6" />}
              {w === 'BOW' && <Target className="w-6 h-6" />}
              {w === 'GUN' && <Zap className="w-6 h-6" />}
              <span className="absolute -bottom-1 -right-1 bg-black text-[8px] px-1 rounded border border-white/20">{i + 1}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Mobile Controls */}
      {isMobile && isGameRunning && !gameOver && (
        <div className="absolute inset-0 pointer-events-none z-[80]">
          {/* Joystick Area */}
          <div 
            className="absolute bottom-12 left-12 w-40 h-40 bg-white/5 rounded-full border border-white/10 pointer-events-auto flex items-center justify-center select-none touch-none"
            onTouchStart={(e) => {
              e.preventDefault();
              const touch = e.changedTouches[0];
              const rect = e.currentTarget.getBoundingClientRect();
              const centerX = rect.left + rect.width / 2;
              const centerY = rect.top + rect.height / 2;
              setJoystick({ active: true, x: 0, y: 0, startX: centerX, startY: centerY, currentX: touch.clientX, currentY: touch.clientY, identifier: touch.identifier });
            }}
            onTouchMove={(e) => {
              e.preventDefault();
              if (!joystick.active) return;
              
              let touch = null;
              for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === joystick.identifier) {
                  touch = e.changedTouches[i];
                  break;
                }
              }
              if (!touch) return;

              const dx = touch.clientX - joystick.startX;
              const dy = touch.clientY - joystick.startY;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const maxDist = 60;
              const normalizedDx = dx / Math.max(dist, 1);
              const normalizedDy = dy / Math.max(dist, 1);
              const finalDist = Math.min(dist, maxDist);
              
              stateRef.current.joystick = {
                x: normalizedDx * (finalDist / maxDist),
                y: normalizedDy * (finalDist / maxDist)
              };
              setJoystick(prev => ({ ...prev, currentX: touch.clientX, currentY: touch.clientY }));
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              let touchEnded = false;
              for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === joystick.identifier) {
                  touchEnded = true;
                  break;
                }
              }
              if (touchEnded) {
                setJoystick({ active: false, x: 0, y: 0, startX: 0, startY: 0, currentX: 0, currentY: 0, identifier: -1 });
                stateRef.current.joystick = { x: 0, y: 0 };
              }
            }}
          >
            <div className="w-16 h-16 bg-white/10 rounded-full border border-white/20 flex items-center justify-center">
              {joystick.active && (
                <motion.div 
                  className="w-10 h-10 bg-blue-500 rounded-full shadow-lg shadow-blue-500/50"
                  style={{
                    x: Math.min(Math.max(joystick.currentX - joystick.startX, -60), 60),
                    y: Math.min(Math.max(joystick.currentY - joystick.startY, -60), 60),
                  }}
                />
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="absolute bottom-12 right-12 flex flex-col gap-4 pointer-events-auto items-end select-none touch-none">
            <div className="flex gap-4 items-end">
              <button 
                className="w-16 h-16 bg-blue-600/80 rounded-full border-2 border-white/20 flex items-center justify-center active:scale-90 transition-transform shadow-xl touch-none"
                onTouchStart={(e) => {
                  e.preventDefault();
                  const weapons: WeaponType[] = ['SWORD', 'BOW', 'GUN'];
                  const nextIdx = (weapons.indexOf(currentWeapon) + 1) % weapons.length;
                  setCurrentWeapon(weapons[nextIdx]);
                }}
              >
                <RefreshCw className="w-8 h-8 text-white" />
              </button>
              
              {/* Aiming/Attack Joystick */}
              <div 
                className="w-32 h-32 bg-red-600/20 rounded-full border-2 border-red-500/30 flex items-center justify-center relative touch-none"
                onTouchStart={(e) => {
                  e.preventDefault();
                  const touch = e.changedTouches[0];
                  const rect = e.currentTarget.getBoundingClientRect();
                  const centerX = rect.left + rect.width / 2;
                  const centerY = rect.top + rect.height / 2;
                  setAimJoystick({ active: true, x: 0, y: 0, startX: centerX, startY: centerY, currentX: touch.clientX, currentY: touch.clientY, identifier: touch.identifier });
                  stateRef.current.aimJoystick.active = true;
                  handleAttack();
                }}
                onTouchMove={(e) => {
                  e.preventDefault();
                  if (!aimJoystick.active) return;

                  let touch = null;
                  for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === aimJoystick.identifier) {
                      touch = e.changedTouches[i];
                      break;
                    }
                  }
                  if (!touch) return;

                  const dx = touch.clientX - aimJoystick.startX;
                  const dy = touch.clientY - aimJoystick.startY;
                  const dist = Math.sqrt(dx * dx + dy * dy);
                  const maxDist = 60;
                  const normalizedDx = dx / Math.max(dist, 1);
                  const normalizedDy = dy / Math.max(dist, 1);
                  const finalDist = Math.min(dist, maxDist);
                  
                  stateRef.current.aimJoystick = {
                    x: normalizedDx * (finalDist / maxDist),
                    y: normalizedDy * (finalDist / maxDist),
                    active: true
                  };
                  setAimJoystick(prev => ({ ...prev, currentX: touch.clientX, currentY: touch.clientY }));
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  let touchEnded = false;
                  for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === aimJoystick.identifier) {
                      touchEnded = true;
                      break;
                    }
                  }
                  if (touchEnded) {
                    setAimJoystick({ active: false, x: 0, y: 0, startX: 0, startY: 0, currentX: 0, currentY: 0, identifier: -1 });
                    stateRef.current.aimJoystick = { x: 0, y: 0, active: false };
                  }
                }}
              >
                <div className="w-16 h-16 bg-red-600/40 rounded-full border border-red-500/50 flex items-center justify-center">
                  {aimJoystick.active ? (
                    <motion.div 
                      className="w-10 h-10 bg-red-500 rounded-full shadow-lg shadow-red-500/50"
                      style={{
                        x: Math.min(Math.max(aimJoystick.currentX - aimJoystick.startX, -60), 60),
                        y: Math.min(Math.max(aimJoystick.currentY - aimJoystick.startY, -60), 60),
                      }}
                    />
                  ) : (
                    <Sword className="w-8 h-8 text-white" />
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-4">
              <button 
                className={`w-16 h-16 rounded-full border-2 flex items-center justify-center active:scale-90 transition-transform touch-none ${stateRef.current.playerStamina >= 10 ? 'bg-yellow-500/80 border-white/20' : 'bg-gray-800/80 border-white/10 opacity-50'}`}
                onTouchStart={(e) => { 
                  e.preventDefault();
                  stateRef.current.keys['sprint'] = true; 
                }}
                onTouchEnd={(e) => { 
                  e.preventDefault();
                  stateRef.current.keys['sprint'] = false; 
                }}
              >
                <Zap className="w-8 h-8 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Boss Warning */}
      <AnimatePresence>
        {bossSpawned && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, y: -50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -50 }}
            className="absolute top-24 left-1/2 -translate-x-1/2 bg-red-600/90 text-white px-8 py-3 rounded-full border-2 border-white shadow-2xl flex items-center gap-3 z-50"
          >
            <Skull className="w-6 h-6 animate-pulse" />
            <span className="font-bold uppercase tracking-[0.2em] text-lg">Boss Approaching!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Level Up Screen */}
      <AnimatePresence>
        {showLevelUp && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-[110]"
          >
            <div className="max-w-md w-full p-8 text-center space-y-8">
              <div className="space-y-2">
                <h2 className="text-4xl font-black italic tracking-tighter uppercase text-blue-400">Level Up!</h2>
                <p className="text-gray-400 font-mono text-xs tracking-widest uppercase">Choose an Upgrade</p>
              </div>

              <div className="grid gap-4">
                {upgrades.map((upgrade) => (
                  <motion.button
                    key={upgrade}
                    whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.1)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setStats(prev => {
                        const next = { ...prev };
                        if (upgrade === 'Increase Max Health') {
                          next.maxHealth += 20;
                          stateRef.current.playerHealth += 20;
                          setPlayerHealth(stateRef.current.playerHealth);
                        }
                        if (upgrade === 'Increase Max Stamina') {
                          next.maxStamina += 50;
                          stateRef.current.playerStamina += 50;
                          setPlayerStamina(stateRef.current.playerStamina);
                        }
                        if (upgrade === 'Increase Damage') next.damage += 0.5;
                        if (upgrade === 'Increase Speed') next.speed += 0.5;
                        if (upgrade === 'Increase Attack Speed') next.attackSpeed += 0.2;
                        if (upgrade === 'Increase Attack Range') next.range += 0.2;
                        return next;
                      });
                      setShowLevelUp(false);
                      setIsGameRunning(true);
                    }}
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-left flex items-center justify-between group"
                  >
                    <span className="font-bold uppercase tracking-wider text-sm">{upgrade}</span>
                    <Play className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Start Screen */}
      <AnimatePresence>
        {!isGameRunning && !showLevelUp && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-[100]"
          >
            <div className="max-w-md w-full p-12 text-center space-y-8">
              <motion.div
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                className="space-y-2"
              >
                <h1 className="text-6xl font-black italic tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500">
                  Forest<br/>Adventure
                </h1>
                <p className="text-gray-400 font-mono text-xs tracking-widest uppercase">Survival RPG Engine v2.0</p>
              </motion.div>

              <div className="grid grid-cols-2 gap-4 text-left">
                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                  <div className="flex items-center gap-2 text-blue-400 mb-2">
                    <Move className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase">Movement</span>
                  </div>
                  <p className="text-xs text-gray-400">WASD or Arrow Keys to explore the infinite forest.</p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                  <div className="flex items-center gap-2 text-yellow-400 mb-2">
                    <Zap className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase">Sprint</span>
                  </div>
                  <p className="text-xs text-gray-400">Hold SHIFT to run faster. Consumes stamina.</p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                  <div className="flex items-center gap-2 text-red-400 mb-2">
                    <Sword className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase">Combat</span>
                  </div>
                  <p className="text-xs text-gray-400">Mouse Click or Space to attack. Keys 1-3 to switch weapons.</p>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={startGame}
                className="w-full py-4 bg-white text-black font-bold uppercase tracking-widest rounded-full flex items-center justify-center gap-2 hover:bg-blue-500 hover:text-white transition-colors"
              >
                <Play className="w-5 h-5 fill-current" />
                Start Adventure
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over Screen */}
      <AnimatePresence>
        {gameOver && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-red-950/90 backdrop-blur-2xl flex items-center justify-center z-[200]"
          >
            <div className="text-center space-y-8 p-12">
              <motion.div
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-red-500/50"
              >
                <Skull className="w-12 h-12 text-white" />
              </motion.div>
              
              <div className="space-y-2">
                <h2 className="text-5xl font-black uppercase tracking-tighter italic">Defeated</h2>
                <p className="text-red-300/60 font-mono text-xs uppercase tracking-widest">Your journey ends here</p>
              </div>

              <div className="bg-black/40 p-6 rounded-2xl border border-white/10 grid grid-cols-2 gap-8">
                <div>
                  <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">Final Score</p>
                  <p className="text-3xl font-black italic">{score.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">Level Reached</p>
                  <p className="text-3xl font-black italic">{level}</p>
                </div>
              </div>

              <button
                onClick={startGame}
                className="px-12 py-4 bg-white text-black font-bold uppercase tracking-widest rounded-full flex items-center justify-center gap-2 mx-auto hover:bg-red-500 hover:text-white transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
                Try Again
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instructions Hint */}
      {!isGameRunning && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 text-gray-500">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4" />
            <span className="text-[10px] uppercase font-bold tracking-widest">Keyboard Recommended</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <MousePointer2 className="w-4 h-4" />
            <span className="text-[10px] uppercase font-bold tracking-widest">Mouse for Aiming</span>
          </div>
        </div>
      )}
    </div>
  );
}
