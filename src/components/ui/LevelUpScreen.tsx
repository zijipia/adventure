/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play } from 'lucide-react';
import { GameStats } from '../../types';

interface LevelUpScreenProps {
  showLevelUp: boolean;
  setShowLevelUp: (show: boolean) => void;
  setIsGameRunning: (running: boolean) => void;
  setStats: React.Dispatch<React.SetStateAction<GameStats>>;
  setPlayerHealth: (health: number) => void;
  setPlayerStamina: (stamina: number) => void;
  stateRef: React.MutableRefObject<any>;
  upgrades: string[];
}

export const LevelUpScreen = ({
  showLevelUp,
  setShowLevelUp,
  setIsGameRunning,
  setStats,
  setPlayerHealth,
  setPlayerStamina,
  stateRef,
  upgrades
}: LevelUpScreenProps) => {
  return (
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
  );
};
