
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
import {GoogleGenAI} from '@google/genai';
import {APP_DEFINITIONS_CONFIG, getSystemPrompt} from '../constants';
import {InteractionData} from '../types';

const ai = new GoogleGenAI({apiKey: process.env.API_KEY || ''});

export async function* streamAppContent(
  interactionHistory: InteractionData[],
  currentMaxHistoryLength: number,
): AsyncGenerator<string, void, void> {
  // Using gemini-3-flash-preview for fastest generation
  const model = 'gemini-3-flash-preview';

  if (!process.env.API_KEY) {
    yield `<div class="p-6 text-center"><p class="text-red-500 font-mono">ERROR: ANTIGRAVITY KEY MISSING</p></div>`;
    return;
  }

  const systemPrompt = getSystemPrompt(currentMaxHistoryLength);
  const currentInteraction = interactionHistory[0];
  const pastInteractions = interactionHistory.slice(1, 10); // Use deeper memory

  const contextStr = pastInteractions.map((it, idx) => 
    `Step ${idx + 1}: [App: ${it.appContext}] Action: ${it.type} on ${it.elementText}`
  ).join('\n');

  const fullPrompt = `${systemPrompt}

User History (Memory Active):
${contextStr}

Immediate Instruction:
User opened/interacted with: ${currentInteraction.appContext}
Action: ${currentInteraction.type}
Target: ${currentInteraction.elementText}
Value: ${currentInteraction.value || 'N/A'}

RENDER INSTANT UI:`;

  try {
    const response = await ai.models.generateContentStream({
      model: model,
      contents: fullPrompt,
      config: {
        // Optimization: 0 thinking budget for instantaneous UI generation
        thinkingConfig: { thinkingBudget: 0 },
        temperature: 0.1, // High deterministic output for speed
      },
    });

    for await (const chunk of response) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error) {
    console.error('Qrok Sync Error:', error);
    yield `<div class="p-4 text-cyan-400 bg-black border border-cyan-500/30 font-mono text-xs">RECONNECTING TO ANTIGRAVITY CORE...</div>`;
  }
}
