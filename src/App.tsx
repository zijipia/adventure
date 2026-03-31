/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gamepad2, Keyboard, Move, Info, Sword, Target, Zap, Heart, Trophy, MousePointer2, Skull } from 'lucide-react';

// Game Constants
const VIEWPORT_WIDTH = 800;
const VIEWPORT_HEIGHT = 600;
const CHUNK_SIZE = 20;
const TILE_SIZE = 40;
const CHUNK_PIXELS = CHUNK_SIZE * TILE_SIZE;

const PLAYER_SIZE = 32;
const PLAYER_SPEED = 5;
const MONSTER_SIZE = 28;
const MONSTER_SPEED = 1.8;
const PROJECTILE_SPEED = 10;
const WORLD_SEED = 12345; // Minecraft-like seed

type WeaponType = 'SWORD' | 'BOW' | 'GUN';
type TileType = 'GRASS' | 'WALL' | 'MOUNTAIN' | 'BOSS_FLOOR' | 'WATER' | 'SAFE_ZONE';

interface Item {
  id: number;
  x: number;
  y: number;
  type: 'HEALTH';
}

interface Position {
  x: number;
  y: number;
}

type MonsterType = 'SLIME' | 'ORC' | 'BOSS' | 'RANGED' | 'CHARGER' | 'HEALER';

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

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playerPos, setPlayerPos] = useState<Position>({ x: 0, y: 0 });
  const [playerHealth, setPlayerHealth] = useState(100);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [keys, setKeys] = useState<{ [key: string]: boolean }>({});
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [currentWeapon, setCurrentWeapon] = useState<WeaponType>('SWORD');
  const [monsters, setMonsters] = useState<Monster[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [isAttacking, setIsAttacking] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [bossSpawned, setBossSpawned] = useState(false);

  // Map state: Map of "chunkX,chunkY" -> TileType[][]
  const chunksRef = useRef<Map<string, TileType[][]>>(new Map());
  
  // Refs for game state to avoid stale closures in requestAnimationFrame
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
    camera: { x: 0, y: 0 },
    bossSpawned: false,
    items: [] as Item[],
    particles: [] as Particle[],
    screenShake: 0,
  });

  const [items, setItems] = useState<Item[]>([]);

  const getChunk = (cx: number, cy: number): TileType[][] => {
    const key = `${cx},${cy}`;
    if (chunksRef.current.has(key)) return chunksRef.current.get(key)!;

    // Generate new chunk
    const newChunk: TileType[][] = [];
    // Deterministic seeded random based on chunk coords and WORLD_SEED
    let s = Math.abs((cx * 73856093) ^ (cy * 19349663) ^ WORLD_SEED);
    const seededRandom = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };

    // Determine if this chunk has a safe zone (rare)
    const hasSafeZone = seededRandom() < 0.05;
    const szX = Math.floor(seededRandom() * (CHUNK_SIZE - 6)) + 3;
    const szY = Math.floor(seededRandom() * (CHUNK_SIZE - 6)) + 3;

    for (let y = 0; y < CHUNK_SIZE; y++) {
      newChunk[y] = [];
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const rand = seededRandom();
        
        // Safe zone cluster
        if (hasSafeZone && Math.abs(x - szX) < 3 && Math.abs(y - szY) < 3) {
          newChunk[y][x] = 'SAFE_ZONE';
          continue;
        }

        if (rand < 0.05) newChunk[y][x] = 'WALL';
        else if (rand < 0.08) newChunk[y][x] = 'MOUNTAIN';
        else if (rand < 0.12) newChunk[y][x] = 'WATER';
        else newChunk[y][x] = 'GRASS';
      }
    }

    chunksRef.current.set(key, newChunk);
    return newChunk;
  };

  const getTileAt = (worldX: number, worldY: number): TileType => {
    const cx = Math.floor(worldX / CHUNK_PIXELS);
    const cy = Math.floor(worldY / CHUNK_PIXELS);
    const chunk = getChunk(cx, cy);
    const tx = Math.floor((worldX % CHUNK_PIXELS + CHUNK_PIXELS) % CHUNK_PIXELS / TILE_SIZE);
    const ty = Math.floor((worldY % CHUNK_PIXELS + CHUNK_PIXELS) % CHUNK_PIXELS / TILE_SIZE);
    return chunk[ty][tx];
  };

  // Handle keyboard and mouse input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setKeys(prev => ({ ...prev, [e.key.toLowerCase()]: true }));
      if (e.key === '1') setCurrentWeapon('SWORD');
      if (e.key === '2') setCurrentWeapon('BOW');
      if (e.key === '3') setCurrentWeapon('GUN');
      if (e.key === ' ' && isGameRunning && !gameOver) {
        handleAttack();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      setKeys(prev => ({ ...prev, [e.key.toLowerCase()]: false }));
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      stateRef.current.mousePos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0 && isGameRunning && !gameOver) {
        handleAttack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [isGameRunning, gameOver, currentWeapon]);

  const handleAttack = () => {
    const now = Date.now();
    const { playerPos, mousePos, camera } = stateRef.current;

    // Calculate direction vector from player center to mouse (in world space)
    const playerCenterX = playerPos.x + PLAYER_SIZE / 2;
    const playerCenterY = playerPos.y + PLAYER_SIZE / 2;
    
    // Mouse position in world space
    const mouseWorldX = mousePos.x + camera.x;
    const mouseWorldY = mousePos.y + camera.y;

    const dx = mouseWorldX - playerCenterX;
    const dy = mouseWorldY - playerCenterY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist === 0) return;

    const dirX = dx / dist;
    const dirY = dy / dist;

    if (currentWeapon === 'SWORD') {
      if (!stateRef.current.isAttacking) {
        stateRef.current.isAttacking = true;
        stateRef.current.attackTimer = 12;
        setIsAttacking(true);
      }
    } else if (currentWeapon === 'BOW' || currentWeapon === 'GUN') {
      const cooldown = currentWeapon === 'BOW' ? 400 : 120;
      if (now - stateRef.current.lastShotTime > cooldown) {
        stateRef.current.lastShotTime = now;
        
        const newProjectile: Projectile = {
          id: now,
          x: playerCenterX,
          y: playerCenterY,
          vx: dirX * PROJECTILE_SPEED,
          vy: dirY * PROJECTILE_SPEED,
          type: currentWeapon === 'BOW' ? 'ARROW' : 'BULLET',
        };
        stateRef.current.projectiles.push(newProjectile);
        setProjectiles([...stateRef.current.projectiles]);
      }
    }
  };

  // Spawn monsters and items
  useEffect(() => {
    if (!isGameRunning || gameOver) return;

    const spawnInterval = setInterval(() => {
      const { playerPos, monsters, items } = stateRef.current;
      
      // Despawn monsters too far from player
      stateRef.current.monsters = monsters.filter(m => {
        const dx = m.x - playerPos.x;
        const dy = m.y - playerPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist < 1200 || m.type === 'BOSS'; // Don't despawn boss
      });
      setMonsters([...stateRef.current.monsters]);

      // Spawn Monsters
      if (stateRef.current.monsters.length < 30) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 500 + Math.random() * 200;
        const x = playerPos.x + Math.cos(angle) * dist;
        const y = playerPos.y + Math.sin(angle) * dist;

        const tile = getTileAt(x, y);
        if (tile === 'GRASS' || tile === 'BOSS_FLOOR') {
          const rand = Math.random();
          let type: MonsterType = 'SLIME';
          let health = 30;
          if (rand < 0.2) { type = 'ORC'; health = 80; }
          else if (rand < 0.35) { type = 'RANGED'; health = 50; }
          else if (rand < 0.5) { type = 'CHARGER'; health = 60; }
          else if (rand < 0.6) { type = 'HEALER'; health = 40; }

          const newMonster: Monster = {
            id: Date.now() + Math.random(),
            x,
            y,
            health,
            maxHealth: health,
            type,
            stuckTime: 0,
            stuckDir: null,
            lastSkillTime: Date.now() + Math.random() * 2000,
          };
          stateRef.current.monsters.push(newMonster);
          setMonsters([...stateRef.current.monsters]);
        }
      }

      // Spawn Items (Health)
      if (items.length < 8 && Math.random() < 0.2) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 200 + Math.random() * 400;
        const x = playerPos.x + Math.cos(angle) * dist;
        const y = playerPos.y + Math.sin(angle) * dist;
        
        if (getTileAt(x, y) === 'GRASS') {
          const newItem: Item = {
            id: Date.now() + Math.random(),
            x,
            y,
            type: 'HEALTH',
          };
          stateRef.current.items.push(newItem);
          setItems([...stateRef.current.items]);
        }
      }
    }, 1500);

    return () => clearInterval(spawnInterval);
  }, [isGameRunning, gameOver]);

  // Boss Spawn Logic (Dynamic)
  useEffect(() => {
    if (!isGameRunning || gameOver || stateRef.current.bossSpawned) return;

    const checkBoss = setInterval(() => {
      const { score } = stateRef.current;
      // Spawn boss every 2000 points
      if (score > 0 && score % 2000 < 50 && !stateRef.current.bossSpawned) {
        stateRef.current.bossSpawned = true;
        setBossSpawned(true);
        
        const angle = Math.random() * Math.PI * 2;
        const dist = 600;
        const { playerPos } = stateRef.current;

        const boss: Monster = {
          id: 9999 + Math.random(),
          x: playerPos.x + Math.cos(angle) * dist,
          y: playerPos.y + Math.sin(angle) * dist,
          health: 1200 + (stateRef.current.level * 200),
          maxHealth: 1200 + (stateRef.current.level * 200),
          type: 'BOSS',
          stuckTime: 0,
          stuckDir: null,
          lastSkillTime: Date.now(),
        };
        stateRef.current.monsters.push(boss);
        setMonsters([...stateRef.current.monsters]);
      }
    }, 2000);

    return () => clearInterval(checkBoss);
  }, [isGameRunning, gameOver]);

  // Game Loop
  useEffect(() => {
    if (!isGameRunning || gameOver) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const update = () => {
      // Update Screen Shake
      if (stateRef.current.screenShake > 0) {
        stateRef.current.screenShake *= 0.9;
        if (stateRef.current.screenShake < 0.1) stateRef.current.screenShake = 0;
      }

      // Update Particles
      stateRef.current.particles = stateRef.current.particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;
        return p.life > 0;
      });

      const { playerPos, monsters, projectiles, mousePos, camera } = stateRef.current;

      // Handle weapon switching
      if (keys['1']) setCurrentWeapon('SWORD');
      if (keys['2']) setCurrentWeapon('BOW');
      if (keys['3']) setCurrentWeapon('GUN');

      // Update Player Position with Collision
      const nextPos = { ...playerPos };
      let moveX = 0;
      let moveY = 0;
      
      // Check if player is on water or safe zone
      const tileAtPlayer = getTileAt(playerPos.x + PLAYER_SIZE / 2, playerPos.y + PLAYER_SIZE / 2);
      const isOnWater = tileAtPlayer === 'WATER';
      const isOnSafeZone = tileAtPlayer === 'SAFE_ZONE';
      
      if (isOnSafeZone) {
        stateRef.current.playerHealth = Math.min(100, stateRef.current.playerHealth + 0.05);
        setPlayerHealth(Math.floor(stateRef.current.playerHealth));
      }

      const currentSpeed = isOnWater ? PLAYER_SPEED * 0.4 : PLAYER_SPEED;

      if (keys['w'] || keys['arrowup']) moveY -= currentSpeed;
      if (keys['s'] || keys['arrowdown']) moveY += currentSpeed;
      if (keys['a'] || keys['arrowleft']) moveX -= currentSpeed;
      if (keys['d'] || keys['arrowright']) moveX += currentSpeed;

      // Collision detection for tiles
      const checkCollision = (nx: number, ny: number) => {
        const tilesToCheck = [
          { x: nx, y: ny },
          { x: nx + PLAYER_SIZE, y: ny },
          { x: nx, y: ny + PLAYER_SIZE },
          { x: nx + PLAYER_SIZE, y: ny + PLAYER_SIZE }
        ];

        for (const t of tilesToCheck) {
          const tile = getTileAt(t.x, t.y);
          if (tile === 'WALL' || tile === 'MOUNTAIN') return true;
        }
        return false;
      };

      if (!checkCollision(playerPos.x + moveX, playerPos.y)) nextPos.x += moveX;
      if (!checkCollision(playerPos.x, playerPos.y + moveY)) nextPos.y += moveY;

      stateRef.current.playerPos = nextPos;
      setPlayerPos(nextPos);

      // Update Camera
      stateRef.current.camera = {
        x: nextPos.x - VIEWPORT_WIDTH / 2 + PLAYER_SIZE / 2,
        y: nextPos.y - VIEWPORT_HEIGHT / 2 + PLAYER_SIZE / 2,
      };

      // Update Attack Timer
      if (stateRef.current.isAttacking) {
        stateRef.current.attackTimer--;
        if (stateRef.current.attackTimer <= 0) {
          stateRef.current.isAttacking = false;
          setIsAttacking(false);
        }
      }

      // Update Projectiles
      stateRef.current.projectiles = projectiles.filter(p => {
        if (p.dead) return false;
        p.x += p.vx;
        p.y += p.vy;
        
        // Wall collision for projectiles
        const tile = getTileAt(p.x, p.y);
        if (tile === 'WALL' || tile === 'MOUNTAIN') return false;

        // Collision with player (if monster projectile)
        if (p.isMonster) {
          const pdx = p.x - (playerPos.x + PLAYER_SIZE / 2);
          const pdy = p.y - (playerPos.y + PLAYER_SIZE / 2);
          const pDist = Math.sqrt(pdx * pdx + pdy * pdy);
          if (pDist < PLAYER_SIZE / 2 + 5) {
            stateRef.current.playerHealth -= 10;
            stateRef.current.screenShake = 8;
            setPlayerHealth(Math.max(0, Math.floor(stateRef.current.playerHealth)));
            if (stateRef.current.playerHealth <= 0) setGameOver(true);
            return false;
          }
        }

        // Distance limit for projectiles
        const dx = p.x - playerPos.x;
        const dy = p.y - playerPos.y;
        return dx * dx + dy * dy < 1000000;
      });
      setProjectiles([...stateRef.current.projectiles]);

      // Update Monsters (Improved AI)
      stateRef.current.monsters.forEach(m => {
        const dx = playerPos.x - m.x;
        const dy = playerPos.y - m.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const speed = m.type === 'BOSS' ? MONSTER_SPEED * 0.7 : (m.type === 'ORC' ? MONSTER_SPEED * 0.8 : MONSTER_SPEED * 1.2);
        
        // Monster Skills & Item Pickup
        const now = Date.now();
        
        // Item Pickup for Monsters
        stateRef.current.items = stateRef.current.items.filter(item => {
          const mSize = m.type === 'BOSS' ? 120 : MONSTER_SIZE;
          const idx = item.x - (m.x + mSize / 2);
          const idy = item.y - (m.y + mSize / 2);
          const iDist = Math.sqrt(idx * idx + idy * idy);
          if (iDist < mSize / 2 + 10) {
            if (item.type === 'HEALTH') {
              m.health = Math.min(m.maxHealth, m.health + 20);
              createParticles(item.x, item.y, '#2ecc71', 5);
            }
            return false;
          }
          return true;
        });

        // Skill Logic
        if (now - m.lastSkillTime > (m.type === 'BOSS' ? 2000 : 3000)) {
          if (m.type === 'RANGED' && dist < 400) {
            // Shoot at player
            const proj: Projectile = {
              id: now + Math.random(),
              x: m.x + MONSTER_SIZE / 2,
              y: m.y + MONSTER_SIZE / 2,
              vx: (dx / dist) * 5,
              vy: (dy / dist) * 5,
              type: 'MONSTER_ORB',
              isMonster: true,
            };
            stateRef.current.projectiles.push(proj);
            m.lastSkillTime = now;
          } else if (m.type === 'CHARGER' && dist < 300 && !m.isCharging) {
            // Charge at player
            m.isCharging = true;
            m.chargeDir = { x: dx / dist, y: dy / dist };
            m.lastSkillTime = now;
            setTimeout(() => { m.isCharging = false; }, 1000);
          } else if (m.type === 'HEALER' && dist < 500) {
            // Heal self and nearby monsters
            m.health = Math.min(m.maxHealth, m.health + 10);
            createParticles(m.x + MONSTER_SIZE / 2, m.y + MONSTER_SIZE / 2, '#2ecc71', 8);
            stateRef.current.monsters.forEach(other => {
              const odx = other.x - m.x;
              const ody = other.y - m.y;
              const oDist = Math.sqrt(odx * odx + ody * ody);
              if (oDist < 200 && other.id !== m.id) {
                other.health = Math.min(other.maxHealth, other.health + 5);
                createParticles(other.x + MONSTER_SIZE / 2, other.y + MONSTER_SIZE / 2, '#2ecc71', 3);
              }
            });
            m.lastSkillTime = now;
          } else if (m.type === 'BOSS') {
            // Boss skills (multi-shot)
            for (let i = 0; i < 8; i++) {
              const angle = (i / 8) * Math.PI * 2;
              const proj: Projectile = {
                id: now + i,
                x: m.x + 60,
                y: m.y + 60,
                vx: Math.cos(angle) * 4,
                vy: Math.sin(angle) * 4,
                type: 'MONSTER_ORB',
                isMonster: true,
              };
              stateRef.current.projectiles.push(proj);
            }
            m.lastSkillTime = now;
          }
        }

        // Apply charging speed
        const currentMoveSpeed = (m.isCharging && m.chargeDir) ? speed * 4 : speed;

        // Monsters avoid safe zones
        const tileAtMonster = getTileAt(m.x + MONSTER_SIZE / 2, m.y + MONSTER_SIZE / 2);
        const inSafeZone = tileAtMonster === 'SAFE_ZONE';

        if (dist > 5) {
          let mvX = (dx / dist) * currentMoveSpeed;
          let mvY = (dy / dist) * currentMoveSpeed;
          
          if (m.isCharging && m.chargeDir) {
            mvX = m.chargeDir.x * currentMoveSpeed;
            mvY = m.chargeDir.y * currentMoveSpeed;
          }

          if (inSafeZone) {
            // Push out of safe zone
            mvX = -mvX;
            mvY = -mvY;
          }

          // Stuck logic: If stuck for too long, try to move perpendicular
          if (m.stuckTime > 30) {
            if (!m.stuckDir) {
              const perpX = -dy / dist;
              const perpY = dx / dist;
              m.stuckDir = Math.random() > 0.5 ? { x: perpX, y: perpY } : { x: -perpX, y: -perpY };
            }
            mvX = m.stuckDir.x * speed;
            mvY = m.stuckDir.y * speed;
            m.stuckTime--;
            if (m.stuckTime <= 0) m.stuckDir = null;
          }

          // Improved AI: Sliding along walls
          const canMoveX = getTileAt(m.x + mvX + MONSTER_SIZE / 2, m.y + MONSTER_SIZE / 2) !== 'WALL' && 
                           getTileAt(m.x + mvX + MONSTER_SIZE / 2, m.y + MONSTER_SIZE / 2) !== 'MOUNTAIN';
          const canMoveY = getTileAt(m.x + MONSTER_SIZE / 2, m.y + mvY + MONSTER_SIZE / 2) !== 'WALL' && 
                           getTileAt(m.x + MONSTER_SIZE / 2, m.y + mvY + MONSTER_SIZE / 2) !== 'MOUNTAIN';

          let moved = false;
          if (canMoveX) { m.x += mvX; moved = true; }
          if (canMoveY) { m.y += mvY; moved = true; }
          
          if (!moved) {
            m.stuckTime++;
            // Jitter
            m.x += (Math.random() - 0.5) * speed * 2;
            m.y += (Math.random() - 0.5) * speed * 2;
          } else {
            if (m.stuckTime > 0 && !m.stuckDir) m.stuckTime--;
          }
        }

        // Collision with player
        const hitDist = m.type === 'BOSS' ? 80 : PLAYER_SIZE;
        if (dist < hitDist) {
          const damage = m.type === 'BOSS' ? 1.5 : (m.type === 'ORC' ? 0.8 : 0.4);
          stateRef.current.playerHealth -= damage;
          stateRef.current.screenShake = 5;
          setPlayerHealth(Math.max(0, Math.floor(stateRef.current.playerHealth)));
          if (stateRef.current.playerHealth <= 0) setGameOver(true);
        }

        // Collision with Sword
        if (stateRef.current.isAttacking) {
          const swordRange = 80;
          const pCenterX = playerPos.x + PLAYER_SIZE / 2;
          const pCenterY = playerPos.y + PLAYER_SIZE / 2;
          const mSize = m.type === 'BOSS' ? 120 : MONSTER_SIZE;
          const mCenterX = m.x + mSize / 2;
          const mCenterY = m.y + mSize / 2;
          
          const distToPlayer = Math.sqrt(Math.pow(mCenterX - pCenterX, 2) + Math.pow(mCenterY - pCenterY, 2));
          
          if (distToPlayer < swordRange) {
            const mouseWorldX = mousePos.x + camera.x;
            const mouseWorldY = mousePos.y + camera.y;
            const angleToMouse = Math.atan2(mouseWorldY - pCenterY, mouseWorldX - pCenterX);
            const angleToMonster = Math.atan2(mCenterY - pCenterY, mCenterX - pCenterX);
            let diff = Math.abs(angleToMouse - angleToMonster);
            if (diff > Math.PI) diff = 2 * Math.PI - diff;
            if (diff < Math.PI / 2) {
              const damage = 3 * (1 + (stateRef.current.level - 1) * 0.2);
              m.health -= damage;
              createParticles(mCenterX, mCenterY, '#fff', 2);
            }
          }
        }

        // Collision with Projectiles
        stateRef.current.projectiles.forEach(p => {
          if (p.dead || p.isMonster) return;
          const mSize = m.type === 'BOSS' ? 120 : MONSTER_SIZE;
          const pdx = p.x - (m.x + mSize / 2);
          const pdy = p.y - (m.y + mSize / 2);
          const pDist = Math.sqrt(pdx * pdx + pdy * pdy);
          if (pDist < mSize / 2 + 5) {
            const baseDamage = p.type === 'ARROW' ? 15 : 10;
            const damage = baseDamage * (1 + (stateRef.current.level - 1) * 0.2);
            m.health -= damage;
            createParticles(p.x, p.y, p.type === 'ARROW' ? '#f1c40f' : '#fff', 3);
            p.dead = true;
          }
        });
      });

      // Filter dead monsters
      const aliveMonsters = stateRef.current.monsters.filter(m => {
        if (m.health <= 0) {
          const xpGain = m.type === 'BOSS' ? 500 : (m.type === 'ORC' ? 25 : 10);
          stateRef.current.xp += xpGain;
          stateRef.current.score += m.type === 'BOSS' ? 1000 : (m.type === 'ORC' ? 30 : 10);
          
          // Level Up Logic
          const nextLevelXp = stateRef.current.level * 100;
          if (stateRef.current.xp >= nextLevelXp) {
            stateRef.current.xp -= nextLevelXp;
            stateRef.current.level += 1;
            stateRef.current.playerHealth = Math.min(100, stateRef.current.playerHealth + 20);
            setLevel(stateRef.current.level);
            setPlayerHealth(Math.floor(stateRef.current.playerHealth));
          }
          
          setXp(stateRef.current.xp);
          setScore(stateRef.current.score);
          createParticles(m.x + MONSTER_SIZE / 2, m.y + MONSTER_SIZE / 2, m.type === 'BOSS' ? '#ef4444' : '#8b4513', 15);
          if (m.type === 'BOSS') {
            stateRef.current.bossSpawned = false;
            setBossSpawned(false);
          }
          return false;
        }
        return true;
      });
      stateRef.current.monsters = aliveMonsters;
      setMonsters([...aliveMonsters]);

      // Update Items (Collision with player)
      stateRef.current.items = stateRef.current.items.filter(item => {
        const dx = playerPos.x + PLAYER_SIZE / 2 - item.x;
        const dy = playerPos.y + PLAYER_SIZE / 2 - item.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 30) {
          if (item.type === 'HEALTH') {
            stateRef.current.playerHealth = Math.min(100, stateRef.current.playerHealth + 30);
            setPlayerHealth(stateRef.current.playerHealth);
          }
          return false;
        }
        return true;
      });
      setItems([...stateRef.current.items]);
    };

    const draw = () => {
      ctx.clearRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
      const { camera, playerPos, monsters, projectiles, isAttacking, mousePos, screenShake, particles } = stateRef.current;

      ctx.save();
      
      // Apply Screen Shake
      if (screenShake > 0) {
        ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
      }

      ctx.translate(-camera.x, -camera.y);

      // Draw Tiles (Infinite)
      const startCX = Math.floor(camera.x / CHUNK_PIXELS);
      const endCX = Math.floor((camera.x + VIEWPORT_WIDTH) / CHUNK_PIXELS);
      const startCY = Math.floor(camera.y / CHUNK_PIXELS);
      const endCY = Math.floor((camera.y + VIEWPORT_HEIGHT) / CHUNK_PIXELS);

      for (let cy = startCY; cy <= endCY; cy++) {
        for (let cx = startCX; cx <= endCX; cx++) {
          const chunk = getChunk(cx, cy);
          for (let y = 0; y < CHUNK_SIZE; y++) {
            for (let x = 0; x < CHUNK_SIZE; x++) {
              const tx = cx * CHUNK_PIXELS + x * TILE_SIZE;
              const ty = cy * CHUNK_PIXELS + y * TILE_SIZE;

              // Cull tiles off-screen
              if (tx < camera.x - TILE_SIZE || tx > camera.x + VIEWPORT_WIDTH || 
                  ty < camera.y - TILE_SIZE || ty > camera.y + VIEWPORT_HEIGHT) continue;

              const type = chunk[y][x];
              if (type === 'GRASS') ctx.fillStyle = '#1b3a1a';
              else if (type === 'WALL') ctx.fillStyle = '#4b5563';
              else if (type === 'MOUNTAIN') ctx.fillStyle = '#1f2937';
              else if (type === 'BOSS_FLOOR') ctx.fillStyle = '#450a0a';
              else if (type === 'WATER') ctx.fillStyle = '#1e3a8a';
              else if (type === 'SAFE_ZONE') ctx.fillStyle = '#064e3b';
              
              ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
              
              // Grid lines
              ctx.strokeStyle = 'rgba(0,0,0,0.1)';
              ctx.strokeRect(tx, ty, TILE_SIZE, TILE_SIZE);
            }
          }
        }
      }

      // Draw Items
      stateRef.current.items.forEach(item => {
        if (item.type === 'HEALTH') {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(item.x, item.y, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'white';
          ctx.fillRect(item.x - 6, item.y - 2, 12, 4);
          ctx.fillRect(item.x - 2, item.y - 6, 4, 12);
        }
      });

      // Draw Monsters
      monsters.forEach(m => {
        const mSize = m.type === 'BOSS' ? 120 : MONSTER_SIZE;
        if (m.type === 'BOSS') ctx.fillStyle = '#ef4444';
        else if (m.type === 'ORC') ctx.fillStyle = '#1e293b';
        else if (m.type === 'RANGED') ctx.fillStyle = '#9333ea';
        else if (m.type === 'CHARGER') ctx.fillStyle = '#f97316';
        else if (m.type === 'HEALER') ctx.fillStyle = '#22c55e';
        else ctx.fillStyle = '#8b4513';

        ctx.beginPath();
        ctx.roundRect(m.x, m.y, mSize, mSize, m.type === 'BOSS' ? 16 : 4);
        ctx.fill();

        if (m.isCharging) {
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          ctx.strokeRect(m.x - 2, m.y - 2, mSize + 4, mSize + 4);
        }

        // Health bar
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(m.x, m.y - 15, mSize, 6);
        ctx.fillStyle = m.type === 'BOSS' ? '#facc15' : '#22c55e';
        ctx.fillRect(m.x, m.y - 15, (m.health / m.maxHealth) * mSize, 6);

        if (m.type === 'BOSS') {
          ctx.fillStyle = 'black';
          ctx.fillRect(m.x + 20, m.y + 30, 20, 20);
          ctx.fillRect(m.x + mSize - 40, m.y + 30, 20, 20);
          ctx.fillStyle = 'red';
          ctx.fillRect(m.x + 25, m.y + 35, 10, 10);
          ctx.fillRect(m.x + mSize - 35, m.y + 35, 10, 10);
        }
      });

      // Draw Particles
      particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Draw Projectiles
      // Draw Projectiles
      stateRef.current.projectiles.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(p.vy, p.vx));
        
        if (p.type === 'ARROW') {
          ctx.strokeStyle = '#a52a2a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-10, 0);
          ctx.lineTo(10, 0);
          ctx.stroke();
          // Arrow head
          ctx.beginPath();
          ctx.moveTo(10, 0);
          ctx.lineTo(5, -3);
          ctx.lineTo(5, 3);
          ctx.closePath();
          ctx.fillStyle = '#a52a2a';
          ctx.fill();
        } else if (p.type === 'BULLET') {
          // Bullet
          ctx.fillStyle = '#f1c40f';
          ctx.beginPath();
          ctx.arc(0, 0, 3, 0, Math.PI * 2);
          ctx.fill();
          // Glow
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#f1c40f';
          ctx.fill();
        } else if (p.type === 'MONSTER_ORB') {
          ctx.fillStyle = '#e11d48';
          ctx.beginPath();
          ctx.arc(0, 0, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 15;
          ctx.shadowColor = '#e11d48';
          ctx.fill();
        }
        ctx.restore();
      });

      // Draw Sword Swing
      if (isAttacking && currentWeapon === 'SWORD') {
        const mouseWorldX = mousePos.x + camera.x;
        const mouseWorldY = mousePos.y + camera.y;
        const angle = Math.atan2(mouseWorldY - (playerPos.y + PLAYER_SIZE / 2), mouseWorldX - (playerPos.x + PLAYER_SIZE / 2));
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(playerPos.x + PLAYER_SIZE / 2, playerPos.y + PLAYER_SIZE / 2, 60, angle - Math.PI / 3, angle + Math.PI / 3);
        ctx.stroke();
      }

      // Draw Player
      ctx.fillStyle = '#3498db';
      ctx.beginPath();
      ctx.roundRect(playerPos.x, playerPos.y, PLAYER_SIZE, PLAYER_SIZE, 8);
      ctx.fill();

      // Eyes
      const mouseWorldX = mousePos.x + camera.x;
      const mouseWorldY = mousePos.y + camera.y;
      const angle = Math.atan2(mouseWorldY - (playerPos.y + PLAYER_SIZE / 2), mouseWorldX - (playerPos.x + PLAYER_SIZE / 2));
      const eyeOffsetX = Math.cos(angle) * 3;
      const eyeOffsetY = Math.sin(angle) * 3;
      ctx.fillStyle = 'white';
      ctx.fillRect(playerPos.x + 6 + eyeOffsetX, playerPos.y + 8 + eyeOffsetY, 6, 6);
      ctx.fillRect(playerPos.x + 20 + eyeOffsetX, playerPos.y + 8 + eyeOffsetY, 6, 6);
      
      ctx.restore();

      // Draw HUD (Static)
      // Local Radar (Minimap)
      const mmSize = 150;
      const radarRange = 1000; // Pixels around player
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(VIEWPORT_WIDTH - mmSize - 20, 20, mmSize, mmSize);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(VIEWPORT_WIDTH - mmSize - 20, 20, mmSize, mmSize);

      // Draw monsters on radar
      monsters.forEach(m => {
        const relX = m.x - playerPos.x;
        const relY = m.y - playerPos.y;
        if (Math.abs(relX) < radarRange && Math.abs(relY) < radarRange) {
          const rx = VIEWPORT_WIDTH - mmSize / 2 - 20 + (relX / radarRange) * (mmSize / 2);
          const ry = 20 + mmSize / 2 + (relY / radarRange) * (mmSize / 2);
          
          let color = '#00ff00';
          if (m.type === 'BOSS') color = '#ff0000';
          else if (m.type === 'ORC') color = '#ff8800';
          else if (m.type === 'RANGED') color = '#9333ea';
          else if (m.type === 'CHARGER') color = '#f97316';
          else if (m.type === 'HEALER') color = '#22c55e';
          
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(rx, ry, m.type === 'BOSS' ? 4 : 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Draw player on radar (center)
      ctx.fillStyle = '#3498db';
      ctx.beginPath();
      ctx.arc(VIEWPORT_WIDTH - mmSize / 2 - 20, 20 + mmSize / 2, 3, 0, Math.PI * 2);
      ctx.fill();

      // Crosshair
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mousePos.x - 10, mousePos.y);
      ctx.lineTo(mousePos.x + 10, mousePos.y);
      ctx.moveTo(mousePos.x, mousePos.y - 10);
      ctx.lineTo(mousePos.x, mousePos.y + 10);
      ctx.stroke();

      animationFrameId = requestAnimationFrame(() => {
        update();
        draw();
      });
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isGameRunning, gameOver, keys, currentWeapon]);

  const createParticles = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      stateRef.current.particles.push({
        id: Math.random(),
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        life: 1,
        color,
      });
    }
  };

  const restartGame = () => {
    chunksRef.current.clear();
    stateRef.current = {
      playerPos: { x: 0, y: 0 },
      mousePos: stateRef.current.mousePos,
      monsters: [],
      projectiles: [],
      isAttacking: false,
      attackTimer: 0,
      lastShotTime: 0,
      score: 0,
      xp: 0,
      level: 1,
      playerHealth: 100,
      camera: { x: 0, y: 0 },
      bossSpawned: false,
      items: [],
      particles: [],
      screenShake: 0,
    };
    setPlayerPos(stateRef.current.playerPos);
    setMonsters([]);
    setProjectiles([]);
    setItems([]);
    setScore(0);
    setXp(0);
    setLevel(1);
    setPlayerHealth(100);
    setGameOver(false);
    setBossSpawned(false);
    setIsGameRunning(true);
  };

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-4 font-sans text-white overflow-hidden cursor-none">
      {/* Game Header */}
      <div className="w-full max-w-[800px] flex justify-between items-end mb-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-3xl font-black tracking-tighter uppercase italic text-green-400 flex items-center gap-2">
            <Skull className="w-8 h-8" />
            Forest Legend
          </h1>
          <div className="flex gap-4 mt-1">
            <div className="flex items-center gap-2 bg-red-500/20 px-3 py-1 rounded-full border border-red-500/30">
              <Heart className="w-4 h-4 text-red-500 fill-red-500" />
              <span className="font-mono font-bold">{playerHealth}%</span>
            </div>
            <div className="flex items-center gap-2 bg-yellow-500/20 px-3 py-1 rounded-full border border-yellow-500/30">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <span className="font-mono font-bold">{score}</span>
            </div>
            <div className="flex items-center gap-2 bg-blue-500/20 px-3 py-1 rounded-full border border-blue-500/30">
              <Zap className="w-4 h-4 text-blue-400" />
              <span className="font-mono font-bold">LVL {level}</span>
            </div>
          </div>
          {/* XP Bar */}
          <div className="w-full bg-white/5 h-1 mt-2 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-blue-500"
              initial={{ width: 0 }}
              animate={{ width: `${(xp / (level * 100)) * 100}%` }}
            />
          </div>
        </motion.div>

        <div className="flex gap-2">
          {[
            { id: 'SWORD', icon: Sword, key: '1', color: 'text-blue-400' },
            { id: 'BOW', icon: Target, key: '2', color: 'text-green-400' },
            { id: 'GUN', icon: Zap, key: '3', color: 'text-yellow-400' }
          ].map((w) => (
            <button
              key={w.id}
              onClick={() => setCurrentWeapon(w.id as WeaponType)}
              className={`relative p-3 rounded-xl border transition-all duration-300 ${
                currentWeapon === w.id 
                  ? 'bg-white/10 border-white/40 scale-110 shadow-[0_0_20px_rgba(255,255,255,0.1)]' 
                  : 'bg-white/5 border-white/10 hover:bg-white/10 opacity-50'
              }`}
            >
              <w.icon className={`w-6 h-6 ${currentWeapon === w.id ? w.color : 'text-white'}`} />
              <div className="text-[10px] mt-1 font-mono font-bold">{w.key}</div>
              {currentWeapon === w.id && (
                <motion.div 
                  layoutId="activeWeapon"
                  className="absolute -inset-1 border-2 border-white/20 rounded-xl"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Game Container */}
      <div className="relative rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.8)] border-4 border-white/5">
        <canvas
          ref={canvasRef}
          width={VIEWPORT_WIDTH}
          height={VIEWPORT_HEIGHT}
          className="block bg-black"
        />

        {/* Boss Alert & Distance */}
        <AnimatePresence>
          {bossSpawned && !gameOver && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute top-8 left-0 right-0 text-center pointer-events-none z-10"
            >
              <h2 className="text-4xl font-black text-red-600 italic tracking-tighter uppercase drop-shadow-[0_0_10px_rgba(255,0,0,0.8)]">
                BOSS DETECTED
              </h2>
              {stateRef.current.monsters.find(m => m.type === 'BOSS') && (
                <p className="text-white font-mono tracking-widest uppercase text-sm mt-2">
                  Distance: {Math.floor(Math.sqrt(
                    Math.pow(stateRef.current.playerPos.x - stateRef.current.monsters.find(m => m.type === 'BOSS')!.x, 2) +
                    Math.pow(stateRef.current.playerPos.y - stateRef.current.monsters.find(m => m.type === 'BOSS')!.y, 2)
                  ))}m
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Overlay UI */}
        <AnimatePresence>
          {(!isGameRunning || gameOver) && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center z-50"
            >
              {gameOver ? (
                <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
                  <Skull className="w-24 h-24 mx-auto mb-4 text-red-600" />
                  <h2 className="text-7xl font-black mb-2 text-red-600 italic tracking-tighter uppercase">Defeated</h2>
                  <p className="text-3xl font-mono mb-10 text-gray-400">Legendary Score: {score}</p>
                  <button
                    onClick={restartGame}
                    className="bg-white text-black px-16 py-5 rounded-full font-black text-2xl hover:bg-green-400 transition-all uppercase tracking-widest shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                  >
                    Resurrect
                  </button>
                </motion.div>
              ) : (
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                  <div className="mb-8 flex justify-center gap-4">
                    <Sword className="w-12 h-12 text-blue-500" />
                    <Skull className="w-12 h-12 text-red-500" />
                    <Target className="w-12 h-12 text-yellow-500" />
                  </div>
                  <h2 className="text-6xl font-black mb-6 italic tracking-tighter uppercase bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
                    Forest Legend
                  </h2>
                  
                  <p className="text-gray-400 max-w-xl mx-auto mb-10 leading-relaxed">
                    Explore a vast procedural world. Find the <span className="text-red-500 font-bold">Boss Arena</span> in the top-right corner. Survive the horde and defeat the Ancient Guardian.
                  </p>

                  <div className="flex flex-col items-center gap-6">
                    <div className="flex gap-10 text-xs font-mono text-gray-500 uppercase tracking-widest">
                      <div className="flex flex-col items-center gap-2"><div className="bg-white/10 px-3 py-2 rounded-lg border border-white/10 text-white">WASD</div> Move</div>
                      <div className="flex flex-col items-center gap-2"><div className="bg-white/10 px-3 py-2 rounded-lg border border-white/10 text-white">CLICK</div> Attack</div>
                      <div className="flex flex-col items-center gap-2"><div className="bg-white/10 px-3 py-2 rounded-lg border border-white/10 text-white">1 - 3</div> Weapon</div>
                    </div>
                    <button
                      onClick={() => setIsGameRunning(true)}
                      className="bg-green-600 text-white px-20 py-6 rounded-full font-black text-3xl hover:bg-green-500 transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(34,197,94,0.4)] uppercase tracking-widest"
                    >
                      Start Adventure
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* World Info */}
      <div className="mt-6 flex gap-12 text-[10px] uppercase tracking-[0.3em] font-bold text-gray-700">
        <div className="flex items-center gap-2"><div className="w-2 h-2 bg-gray-600 rounded-full" /> Map: Infinite</div>
        <div className="flex items-center gap-2"><div className="w-2 h-2 bg-green-800 rounded-full" /> Safe Zone: Heals</div>
        <div className="flex items-center gap-2"><div className="w-2 h-2 bg-blue-600 rounded-full" /> Engine: React Canvas</div>
      </div>
    </div>
  );
}
