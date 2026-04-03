/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Skull, RefreshCw } from 'lucide-react';

interface GameOverScreenProps {
  gameOver: boolean;
  score: number;
  level: number;
  startGame: () => void;
}

export const GameOverScreen = ({ gameOver, score, level, startGame }: GameOverScreenProps) => {
  return (
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
  );
};
