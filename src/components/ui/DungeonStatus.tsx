/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Skull, ShieldAlert } from 'lucide-react';

interface DungeonStatusProps {
  active: boolean;
  monsterCount: number;
}

export const DungeonStatus = ({ active, monsterCount }: DungeonStatusProps) => {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.8 }}
          className="fixed top-24 left-1/2 -translate-x-1/2 z-[150] pointer-events-none"
        >
          <div className="bg-red-950/80 backdrop-blur-md border-2 border-red-500/50 px-8 py-4 rounded-2xl shadow-[0_0_30px_rgba(239,68,68,0.3)] flex flex-col items-center gap-2">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 text-red-500 animate-pulse" />
              <h2 className="text-2xl font-black uppercase tracking-tighter text-white">
                Dungeon Active
              </h2>
              <ShieldAlert className="w-6 h-6 text-red-500 animate-pulse" />
            </div>
            
            <div className="flex items-center gap-2 bg-black/40 px-4 py-1 rounded-full border border-white/10">
              <Skull className="w-4 h-4 text-red-400" />
              <span className="text-sm font-mono font-bold text-red-200">
                MONSTERS REMAINING: {monsterCount}
              </span>
            </div>
            
            <p className="text-[10px] font-bold text-red-400/60 uppercase tracking-widest">
              Escape is impossible until all are dead
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
