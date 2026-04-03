/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sword, Target, Zap } from 'lucide-react';
import { WeaponType } from '../../types';

interface WeaponSelectorProps {
  currentWeapon: WeaponType;
  setCurrentWeapon: (weapon: WeaponType) => void;
  isMobile: boolean;
}

export const WeaponSelector = ({ currentWeapon, setCurrentWeapon, isMobile }: WeaponSelectorProps) => {
  return (
    <div className={`flex gap-2 pointer-events-auto ${isMobile ? 'scale-125 origin-top-right' : ''}`}>
      {(['SWORD', 'BOW', 'GUN'] as WeaponType[]).map((w, i) => (
        <button
          key={w}
          onClick={() => setCurrentWeapon(w)}
          className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center transition-all ${
            currentWeapon === w 
            ? 'bg-blue-600 border-white scale-110 shadow-lg shadow-blue-500/50' 
            : 'bg-black/60 border-white/20 hover:border-white/50'
          }`}
        >
          {w === 'SWORD' && <Sword className="w-6 h-6" />}
          {w === 'BOW' && <Target className="w-6 h-6" />}
          {w === 'GUN' && <Zap className="w-6 h-6" />}
          <span className="absolute -bottom-1 -right-1 bg-black text-[8px] px-1 rounded border border-white/20">{i + 1}</span>
        </button>
      ))}
    </div>
  );
};
