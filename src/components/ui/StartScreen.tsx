/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Move, Zap, Sword, Play } from 'lucide-react';

interface StartScreenProps {
  isGameRunning: boolean;
  showLevelUp: boolean;
  startGame: () => void;
}

export const StartScreen = ({ isGameRunning, showLevelUp, startGame }: StartScreenProps) => {
  return (
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
  );
};
