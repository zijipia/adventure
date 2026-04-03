/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Skull } from 'lucide-react';

interface BossWarningProps {
  bossSpawned: boolean;
}

export const BossWarning = ({ bossSpawned }: BossWarningProps) => {
  return (
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
  );
};
