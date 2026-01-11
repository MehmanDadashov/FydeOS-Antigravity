/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
import React from 'react';

interface WindowProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  isAppOpen: boolean;
}

export const Window: React.FC<WindowProps> = ({
  title,
  children,
  onClose,
}) => {
  return (
    <div className="w-[1000px] h-[720px] window-fyde flex flex-col animate-in fade-in zoom-in-95 duration-500">
      {/* Neural Title Bar */}
      <div className="title-bar-fyde">
        <div className="flex items-center gap-4">
          <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]"></div>
          <span className="text-[10px] font-black text-white/80 uppercase tracking-[0.3em] truncate max-w-[300px] italic">
            {title}
          </span>
        </div>
        
        <div className="flex items-center gap-6">
          <button className="text-white/30 hover:text-cyan-400 transition-all active:scale-75">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 8H12" />
            </svg>
          </button>
          <button className="text-white/30 hover:text-cyan-400 transition-all active:scale-75">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="10" height="10" rx="1" />
            </svg>
          </button>
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          <button 
            onClick={onClose}
            className="text-white/30 hover:text-red-500 transition-all active:scale-75 hover:rotate-90"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4L12 12M12 4L4 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Neural Content Area */}
      <div className="flex-grow overflow-hidden relative">
        {children}
      </div>
    </div>
  );
};