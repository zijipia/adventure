/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  PLAYER_SIZE, MONSTER_SIZE, PROJECTILE_SPEED, DESPAWN_DIST, 
  MONSTER_SPEED, GRID_SIZE, CHUNK_PIXELS, CHUNK_SIZE, INITIAL_WORLD_SEED 
} from '../constants';
import { 
  getTileAt, getRandomUpgrades, createParticles, checkCollision, redrawChunkCanvas, generateDungeonMaze 
} from '../utils/gameUtils';
import { GameStats, WeaponType, MonsterType } from '../types';

interface GameLoopProps {
  isGameRunning: boolean;
  gameOver: boolean;
  setGameOver: (v: boolean) => void;
  setPlayerHealth: (v: number) => void;
  setPlayerStamina: (v: number) => void;
  setScore: (v: number) => void;
  setLevel: (v: number) => void;
  setXp: (v: number) => void;
  setUpgrades: (v: any[]) => void;
  setShowLevelUp: (v: boolean) => void;
  setIsGameRunning: (v: boolean) => void;
  setRenderState: (v: any) => void;
  stateRef: React.MutableRefObject<any>;
  chunksRef: React.MutableRefObject<any>;
  viewport: { width: number; height: number };
  currentWeapon: WeaponType;
  stats: GameStats;
  handleAttack: () => void;
  isMobile: boolean;
}

export const useGameLoop = ({
  isGameRunning,
  gameOver,
  setGameOver,
  setPlayerHealth,
  setPlayerStamina,
  setScore,
  setLevel,
  setXp,
  setUpgrades,
  setShowLevelUp,
  setIsGameRunning,
  setRenderState,
  stateRef,
  chunksRef,
  viewport,
  currentWeapon,
  stats,
  handleAttack,
  isMobile
}: GameLoopProps) => {
  useEffect(() => {
    if (!isGameRunning || gameOver) return;

    let animationFrameId: number;
    const update = () => {
      const { keys, playerPos, monsters, projectiles, particles, camera } = stateRef.current;
      
      // Player Movement
      let moveX = 0;
      let moveY = 0;
      const tileAtPlayer = getTileAt(playerPos.x + PLAYER_SIZE / 2, playerPos.y + PLAYER_SIZE / 2, chunksRef, stateRef);
      
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

      const nextPos = { ...playerPos };
      if (!checkCollision(playerPos.x + moveX, playerPos.y, chunksRef, stateRef)) nextPos.x += moveX;
      if (!checkCollision(playerPos.x, playerPos.y + moveY, chunksRef, stateRef)) nextPos.y += moveY;

      // Dungeon Logic
      const { dungeon } = stateRef.current;
      const now = Date.now();
      if (tileAtPlayer === 'DUNGEON_ENTRANCE' && !dungeon.active && now - dungeon.lastDungeonTime > 5000) {
        // Start Dungeon
        const preDungeonPos = { ...nextPos };
        const dungeonPos = { x: 1000 * CHUNK_PIXELS + CHUNK_PIXELS / 2, y: 1000 * CHUNK_PIXELS + CHUNK_PIXELS / 2 };
        
        const cx = Math.floor(nextPos.x / CHUNK_PIXELS);
        const cy = Math.floor(nextPos.y / CHUNK_PIXELS);
        
        // Generate a connected maze for this dungeon
        const mazeSeed = Math.abs((cx * 73856093) ^ (cy * 19349663) ^ INITIAL_WORLD_SEED);
        const maze = generateDungeonMaze(mazeSeed);

        stateRef.current.dungeon = {
          ...stateRef.current.dungeon,
          active: true,
          center: { x: dungeonPos.x, y: dungeonPos.y },
          monsterIds: [],
          radius: 1500,
          preDungeonPos,
          entranceChunk: { cx, cy },
          maze
        };
        
        nextPos.x = dungeonPos.x;
        nextPos.y = dungeonPos.y;

        // Spawn Dungeon Monsters
        const monsterTypes: MonsterType[] = ['ORC', 'RANGED', 'CHARGER', 'EXPLODER', 'SHIELDBEARER'];
        let spawnedCount = 0;
        let attempts = 0;
        while (spawnedCount < 20 && attempts < 100) {
          attempts++;
          const angle = Math.random() * Math.PI * 2;
          const dist = 100 + Math.random() * 800;
          const mx = nextPos.x + Math.cos(angle) * dist;
          const my = nextPos.y + Math.sin(angle) * dist;
          
          const tile = getTileAt(mx, my, chunksRef, stateRef);
          if (tile === 'DUNGEON_FLOOR') {
            const id = Math.random();
            const type = monsterTypes[Math.floor(Math.random() * monsterTypes.length)];
            const health = type === 'SHIELDBEARER' ? 200 : 100;
            
            stateRef.current.monsters.push({
              id, x: mx, y: my, health, maxHealth: health, type,
              stuckTime: 0, stuckDir: null, lastSkillTime: Date.now()
            });
            stateRef.current.dungeon.monsterIds.push(id);
            spawnedCount++;
          }
        }
        createParticles(nextPos.x, nextPos.y, '#7c3aed', 50, stateRef.current.particles);
        stateRef.current.screenShake = 20;
      }

      if (dungeon.active) {
        // Contain player
        const dx = nextPos.x - dungeon.center.x;
        const dy = nextPos.y - dungeon.center.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > dungeon.radius) {
          nextPos.x = dungeon.center.x + (dx / dist) * dungeon.radius;
          nextPos.y = dungeon.center.y + (dy / dist) * dungeon.radius;
        }

        // Check if dungeon is cleared
        const aliveDungeonMonsters = stateRef.current.monsters.filter((m: any) => 
          stateRef.current.dungeon.monsterIds.includes(m.id)
        );
        stateRef.current.dungeon.monsterIds = aliveDungeonMonsters.map((m: any) => m.id);
        
        if (stateRef.current.dungeon.monsterIds.length === 0) {
          stateRef.current.dungeon.active = false;
          stateRef.current.dungeon.lastDungeonTime = Date.now();
          
          // Clear dungeon from world
          if (dungeon.entranceChunk) {
            const key = `${dungeon.entranceChunk.cx},${dungeon.entranceChunk.cy}`;
            stateRef.current.clearedDungeons.add(key);
            const chunk = chunksRef.current.get(key);
            if (chunk) {
              // Replace dungeon tiles with grass
              for (let y = 0; y < CHUNK_SIZE; y++) {
                for (let x = 0; x < CHUNK_SIZE; x++) {
                  const t = chunk.tiles[y][x];
                  if (t === 'DUNGEON_ENTRANCE' || t === 'DUNGEON_FLOOR' || t === 'DUNGEON_WALL') {
                    chunk.tiles[y][x] = 'GRASS';
                  }
                }
              }
              redrawChunkCanvas(chunk);
            }
          }

          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
          createParticles(nextPos.x, nextPos.y, '#10b981', 50, stateRef.current.particles);
          stateRef.current.screenShake = 10;
          
          // Return to real world
          if (dungeon.preDungeonPos) {
            nextPos.x = dungeon.preDungeonPos.x;
            nextPos.y = dungeon.preDungeonPos.y + 100; // Offset slightly to avoid re-entry
          }

          // Reward: Level Up Screen
          setUpgrades(getRandomUpgrades(3));
          setShowLevelUp(true);
          setIsGameRunning(false);
        }
      }

      stateRef.current.playerPos = nextPos;

      // Camera
      let shakeX = 0;
      let shakeY = 0;
      if (stateRef.current.screenShake > 0) {
        shakeX = (Math.random() - 0.5) * stateRef.current.screenShake;
        shakeY = (Math.random() - 0.5) * stateRef.current.screenShake;
        stateRef.current.screenShake *= 0.9;
        if (stateRef.current.screenShake < 0.1) stateRef.current.screenShake = 0;
      }

      stateRef.current.camera = {
        x: nextPos.x - viewport.width / 2 + PLAYER_SIZE / 2 + shakeX,
        y: nextPos.y - viewport.height / 2 + PLAYER_SIZE / 2 + shakeY,
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
      stateRef.current.projectiles = projectiles.filter((p: any) => {
        p.x += p.vx;
        p.y += p.vy;
        const t = getTileAt(p.x, p.y, chunksRef, stateRef);
        if (t === 'WALL' || t === 'MOUNTAIN' || t === 'DUNGEON_WALL') return false;
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
        return Math.sqrt((p.x - stateRef.current.playerPos.x) ** 2 + (p.y - stateRef.current.playerPos.y) ** 2) < 1000;
      });

      // Items
      stateRef.current.items = stateRef.current.items.filter((item: any) => {
        const dx = stateRef.current.playerPos.x - item.x;
        const dy = stateRef.current.playerPos.y - item.y;
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
              setUpgrades(getRandomUpgrades(3));
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
      const playerProjectiles = stateRef.current.projectiles.filter((p: any) => !p.isMonster && !p.dead);
      
      // Build spatial grid for monsters
      const monsterGrid: Record<string, any[]> = {};
      stateRef.current.monsters.forEach((m: any) => {
        const gx = Math.floor(m.x / GRID_SIZE);
        const gy = Math.floor(m.y / GRID_SIZE);
        const key = `${gx},${gy}`;
        if (!monsterGrid[key]) monsterGrid[key] = [];
        monsterGrid[key].push(m);
      });

      stateRef.current.monsters.forEach((m: any) => {
        const dx = stateRef.current.playerPos.x - m.x;
        const dy = stateRef.current.playerPos.y - m.y;
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
                      if (Math.random() < 0.05) createParticles(other.x + MONSTER_SIZE/2, other.y + MONSTER_SIZE/2, '#2ecc71', 1, stateRef.current.particles);
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
            createParticles(m.x + MONSTER_SIZE/2, m.y + MONSTER_SIZE/2, '#f1c40f', 10, stateRef.current.particles);
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
                if (stateRef.current.playerHealth <= 0) setGameOver(true);
              }
              createParticles(m.x, m.y, '#f39c12', 20, stateRef.current.particles);
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
              createParticles(m.x + 60, m.y + 60, '#991b1b', 15, stateRef.current.particles);
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
          const canX = !['WALL', 'MOUNTAIN', 'DUNGEON_WALL'].includes(getTileAt(m.x + mvX + mSize / 2, m.y + mSize / 2, chunksRef, stateRef));
          const canY = !['WALL', 'MOUNTAIN', 'DUNGEON_WALL'].includes(getTileAt(m.x + mSize / 2, m.y + mvY + mSize / 2, chunksRef, stateRef));
          
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
          const pCenterX = stateRef.current.playerPos.x + PLAYER_SIZE / 2;
          const pCenterY = stateRef.current.playerPos.y + PLAYER_SIZE / 2;
          const distToP = Math.sqrt((mCenterX - pCenterX) ** 2 + (mCenterY - pCenterY) ** 2);
          if (distToP < 80 * stats.range + mSize / 2) {
            m.health -= 5 * stats.damage;
            createParticles(mCenterX, mCenterY, '#e74c3c', 2, stateRef.current.particles);
          }
        }
      });

      // Projectile-Monster Collision using Spatial Grid
      playerProjectiles.forEach((p: any) => {
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
                  createParticles(p.x, p.y, m.type === 'SHIELDBEARER' ? '#94a3b8' : '#e74c3c', 3, stateRef.current.particles);
                }
              }
            }
          }
        }
      });

      // Death & XP & Despawning
      stateRef.current.monsters = stateRef.current.monsters.filter((m: any) => {
        const dx = m.x - stateRef.current.playerPos.x;
        const dy = m.y - stateRef.current.playerPos.y;
        const distSq = dx * dx + dy * dy;

        // Despawn if too far (3x frame roughly)
        if (distSq > DESPAWN_DIST * DESPAWN_DIST) {
          if (m.type === 'BOSS') {
            stateRef.current.bossSpawned = false;
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
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
          }
          return false;
        }
        return true;
      });

      // Particles
      stateRef.current.particles = particles.filter((p: any) => {
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
        dungeon: {
          active: stateRef.current.dungeon.active,
          monsterCount: stateRef.current.dungeon.monsterIds.length,
          maze: stateRef.current.dungeon.maze
        }
      });

      animationFrameId = requestAnimationFrame(update);
    };
    animationFrameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isGameRunning, gameOver, viewport, currentWeapon, stats, handleAttack, isMobile]);
};
