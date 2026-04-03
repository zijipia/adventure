/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Heart, Zap, Trophy } from 'lucide-react';
import { GameStats } from '../../types';

interface HUDProps {
  playerHealth: number;
  playerStamina: number;
  xp: number;
  level: number;
  score: number;
  stats: GameStats;
}

export const HUD = ({ playerHealth, playerStamina, xp, level, score, stats }: HUDProps) => {
  return (
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
  );
};
