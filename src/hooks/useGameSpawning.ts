/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { MAX_MONSTERS } from '../constants';
import { getTileAt } from '../utils/gameUtils';
import { MonsterType } from '../types';

interface GameSpawningProps {
  isGameRunning: boolean;
  gameOver: boolean;
  stateRef: React.MutableRefObject<any>;
  chunksRef: React.MutableRefObject<any>;
  setBossSpawned: (v: boolean) => void;
}

export const useGameSpawning = ({
  isGameRunning,
  gameOver,
  stateRef,
  chunksRef,
  setBossSpawned
}: GameSpawningProps) => {
  // Regular Spawning
  useEffect(() => {
    if (!isGameRunning || gameOver) return;
    const spawnTimer = setInterval(() => {
      const { playerPos, monsters, level } = stateRef.current;
      if (monsters.length < MAX_MONSTERS) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 600;
        const x = playerPos.x + Math.cos(angle) * dist;
        const y = playerPos.y + Math.sin(angle) * dist;
        const tile = getTileAt(x, y, chunksRef);
        if (['GRASS', 'FOREST', 'JUNGLE', 'DESERT'].includes(tile)) {
          const rand = Math.random();
          let type: MonsterType = 'SLIME';
          let health = 30;
          
          if (level >= 12 && rand < 0.05) {
            type = 'SHIELDBEARER';
            health = 200;
          } else if (level >= 10 && rand < 0.1) {
            type = 'GHOST';
            health = 50;
          } else if (level >= 8 && rand < 0.1) {
            type = 'EXPLODER';
            health = 30;
          } else if (level >= 6 && rand < 0.15) {
            type = 'SPLITTER';
            health = 80;
          } else if (level >= 7 && rand < 0.2) {
            type = 'SUMMONER';
            health = 100;
          } else if (level >= 5 && rand < 0.3) {
            type = 'HEALER';
            health = 50;
          } else if (level >= 3 && rand < 0.45) {
            type = 'CHARGER';
            health = 60;
          } else if (level >= 2 && rand < 0.6) {
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

  // Boss Spawning
  useEffect(() => {
    if (!isGameRunning || gameOver || stateRef.current.bossSpawned) return;
    const bossTimer = setInterval(() => {
      const { score, bossSpawned: bSpawned, playerPos } = stateRef.current;
      if (score > 0 && score % 2000 < 100 && !bSpawned) {
        stateRef.current.bossSpawned = true;
        setBossSpawned(true);
        const angle = Math.random() * Math.PI * 2;
        const x = playerPos.x + Math.cos(angle) * 700;
        const y = playerPos.y + Math.sin(angle) * 700;
        stateRef.current.monsters.push({
          id: 999, x, y, health: 3000, maxHealth: 3000, type: 'BOSS',
          stuckTime: 0, stuckDir: null, lastSkillTime: Date.now()
        });
      }
    }, 5000);
    return () => clearInterval(bossTimer);
  }, [isGameRunning, gameOver]);
};
