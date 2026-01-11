/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
import React, {useEffect, useState} from 'react';

interface ParametersPanelProps {
  currentLength: number;
  onUpdateHistoryLength: (newLength: number) => void;
  onClosePanel: () => void;
  isStatefulnessEnabled: boolean;
  onSetStatefulness: (enabled: boolean) => void;
}

export const ParametersPanel: React.FC<ParametersPanelProps> = ({
  currentLength,
  onUpdateHistoryLength,
  onClosePanel,
  isStatefulnessEnabled,
  onSetStatefulness,
}) => {
  const [localHistoryLengthInput, setLocalHistoryLengthInput] = useState<string>(currentLength.toString());
  const [localStatefulnessChecked, setLocalStatefulnessChecked] = useState<boolean>(isStatefulnessEnabled);

  useEffect(() => {
    setLocalHistoryLengthInput(currentLength.toString());
  }, [currentLength]);

  useEffect(() => {
    setLocalStatefulnessChecked(isStatefulnessEnabled);
  }, [isStatefulnessEnabled]);

  const handleApplyParameters = () => {
    const newLength = parseInt(localHistoryLengthInput, 10);
    if (!isNaN(newLength) && newLength >= 0 && newLength <= 20) {
      onUpdateHistoryLength(newLength);
    }
    onSetStatefulness(localStatefulnessChecked);
    onClosePanel();
  };

  return (
    <div className="p-12 bg-black/20 h-full flex flex-col items-center justify-center text-white font-sans">
      <div className="w-full max-w-xl space-y-12">
        <div className="text-center space-y-2">
          <h2 className="text-4xl font-black uppercase tracking-[0.4em] italic bg-gradient-to-b from-white to-cyan-400 bg-clip-text text-transparent">Core Optimization</h2>
          <p className="text-[10px] text-cyan-400/60 font-mono tracking-widest uppercase">System Memory & Neural Calibration</p>
        </div>

        <div className="space-y-8">
          <div className="llm-container border-cyan-500/20 bg-cyan-500/5 group">
            <div className="flex justify-between items-center w-full">
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-white/80">Neural Buffer Length</label>
                <p className="text-[10px] text-white/40 mt-1">Number of interactions stored in synaptic memory</p>
              </div>
              <input
                type="number"
                value={localHistoryLengthInput}
                onChange={(e) => setLocalHistoryLengthInput(e.target.value)}
                min="0"
                max="20"
                className="w-20 bg-black/40 border border-white/10 rounded-xl p-3 text-center text-cyan-400 font-mono focus:border-cyan-400 transition-all outline-none"
              />
            </div>
          </div>

          <div className="llm-container border-purple-500/20 bg-purple-500/5">
            <div className="flex justify-between items-center w-full">
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-white/80">Stateful Persistence</label>
                <p className="text-[10px] text-white/40 mt-1">Enable deep temporal consistency across sessions</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localStatefulnessChecked}
                  onChange={(e) => setLocalStatefulnessChecked(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-cyan-500 shadow-inner"></div>
              </label>
            </div>
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button
            onClick={handleApplyParameters}
            className="flex-grow llm-button"
          >
            Apply Sync
          </button>
          <button
            onClick={onClosePanel}
            className="px-8 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
          >
            Abort
          </button>
        </div>
      </div>
    </div>
  );
};