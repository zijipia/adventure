/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Map as MapIcon, Navigation } from 'lucide-react';
import { Position, Monster } from '../../types';

interface MinimapProps {
  playerPos: Position;
  monsters: Monster[];
  inDungeon: boolean;
  maze?: boolean[][] | null;
}

export const Minimap = ({ playerPos, monsters, inDungeon, maze }: MinimapProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = 120;
  const scale = inDungeon ? 0.1 : 0.05;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, size, size);
    
    // Background
    ctx.fillStyle = inDungeon ? 'rgba(15, 15, 25, 0.95)' : 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, size, size);
    
    const centerX = size / 2;
    const centerY = size / 2;

    // Render Maze Walls
    if (inDungeon && maze) {
      ctx.fillStyle = 'rgba(124, 58, 237, 0.4)';
      const cellSize = 80 * scale; // Each maze cell is 80x80 pixels
      const mazeSize = 31;
      const centerWorld = 1000 * 800 + 400; // Dungeon center in pixels

      for (let my = 0; my < mazeSize; my++) {
        for (let mx = 0; mx < mazeSize; mx++) {
          if (!maze[my][mx]) { // Wall
            const worldX = centerWorld + (mx - 15) * 80;
            const worldY = centerWorld + (my - 15) * 80;
            
            const dx = (worldX - playerPos.x) * scale;
            const dy = (worldY - playerPos.y) * scale;
            
            if (Math.abs(dx) < size / 2 + cellSize && Math.abs(dy) < size / 2 + cellSize) {
              ctx.fillRect(centerX + dx, centerY + dy, cellSize, cellSize);
            }
          }
        }
      }
    }

    // Grid/Border
    ctx.strokeStyle = inDungeon ? 'rgba(124, 58, 237, 0.6)' : 'rgba(255, 255, 255, 0.1)';
    ctx.strokeRect(0, 0, size, size);

    // Monsters
    ctx.fillStyle = '#ef4444';
    monsters.forEach(m => {
      const dx = (m.x - playerPos.x) * scale;
      const dy = (m.y - playerPos.y) * scale;
      if (Math.abs(dx) < size / 2 && Math.abs(dy) < size / 2) {
        ctx.beginPath();
        ctx.arc(centerX + dx, centerY + dy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Player
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 2.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Player direction indicator (optional, but let's keep it simple)
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();

  }, [playerPos, monsters, inDungeon, scale]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="fixed top-24 right-6 z-[100] flex flex-col gap-2"
    >
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
        <div className="relative bg-black/60 backdrop-blur-md border border-white/10 p-1 rounded-lg overflow-hidden shadow-2xl">
          <canvas
            ref={canvasRef}
            width={size}
            height={size}
            className="rounded-sm"
          />
          
          {/* Label */}
          <div className="absolute bottom-1 left-1 flex items-center gap-1 bg-black/60 px-1.5 py-0.5 rounded text-[8px] font-bold text-white/80 uppercase tracking-tighter">
            {inDungeon ? (
              <>
                <Navigation className="w-2 h-2 text-purple-400" />
                <span>Dungeon Area</span>
              </>
            ) : (
              <>
                <MapIcon className="w-2 h-2 text-blue-400" />
                <span>World Map</span>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
