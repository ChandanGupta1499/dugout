import { buildBanterPrompt } from './dist-test-src/gemini.js';

const chat = [
  { userId: 'u1', name: 'Real Madrid Fan', text: "Quiet in here... already scared of another 90th-minute Madrid comeback? Wake up chat, Hala Madrid!" },
  { userId: 'u2', name: 'Inter Milan Fan', text: "Relying on 90th-minute luck again? We'll have this wrapped up by halftime. Forza Inter!" },
  { userId: 'u1', name: 'Real Madrid Fan', text: "Celebrate tackles all day mate, scoreboard says 1-0!" },
  { userId: 'u2', name: 'Inter Milan Fan', text: "Gifted you one goal, but Courtois is sweating bullets! that equalizer is loading!" },
  { userId: 'u1', name: 'Real Madrid Fan', text: "Pavard needed a miracle tackle mate! 1-0 is just the start!" },
  { userId: 'u2', name: 'Inter Milan Fan', text: "Courtois is working overtime saving Calhanoglu's rockets mate. That equalizer is coming!" },
];
const commentary = [
  { at: "20'", text: "PENALTY CLAIM! Pavard makes an unbelievable tackle just as Vinicius is about to pull the trigger. Sensational defending." },
];

console.log(buildBanterPrompt('inter-milan', chat, commentary));
