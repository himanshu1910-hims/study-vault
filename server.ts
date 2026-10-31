import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured. Please check the Settings > Secrets panel.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function stripHtmlToReadableText(html: string): { title: string; content: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';

  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<\/(p|div|h1|h2|h3|h4|li|article|section|br)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();

  return {
    title: rawTitle.slice(0, 200),
    content: cleaned.slice(0, 35000),
  };
}

interface DialogueTurn {
  speaker: 'Alex' | 'Sam';
  text: string;
  style?: string;
}

interface GeneratedScriptPayload {
  title: string;
  summaryText: string;
  keyTakeaways: string[];
  dialogueTurns: DialogueTurn[];
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // Fetch and extract readable article text from a provided URL
  app.post('/api/fetch-article', async (req: Request, res: Response) => {
    try {
      const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
      if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) {
        res.status(400).json({ error: 'Please enter a valid http:// or https:// article URL.' });
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const response = await fetch(rawUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; StudyVaultReader/2.0)',
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        res.status(422).json({
          error: `Could not fetch URL (HTTP ${response.status}). Try pasting the article text directly.`,
        });
        return;
      }

      const rawText = await response.text();
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/plain')) {
        res.json({
          title: new URL(rawUrl).hostname,
          content: rawText.slice(0, 35000),
        });
        return;
      }

      const extracted = stripHtmlToReadableText(rawText);
      if (!extracted.content || extracted.content.length < 60) {
        res.status(422).json({
          error: 'This site requires JavaScript to render its article body. Please copy and paste the article text directly.',
        });
        return;
      }

      res.json({
        title: extracted.title || new URL(rawUrl).hostname,
        content: extracted.content,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch article URL.';
      res.status(500).json({
        error: `Unable to load URL (${message}). You can paste the article text directly below.`,
      });
    }
  });

  // Generate personalized commute summary + TTS WAV audio using gemini-3.8-flash + gemini-3.8-flash-tts
  app.post('/api/audio-summary', async (req: Request, res: Response) => {
    try {
      const ai = getGenAIClient();
      const sourceText = typeof req.body?.sourceText === 'string' ? req.body.sourceText.trim() : '';
      const sourceTitle = typeof req.body?.sourceTitle === 'string' ? req.body.sourceTitle.trim() : '';
      const mode: 'podcast' | 'single' = req.body?.mode === 'single' ? 'single' : 'podcast';
      const primaryVoice = typeof req.body?.voiceName === 'string' && req.body.voiceName ? req.body.voiceName : (mode === 'podcast' ? 'Puck' : 'Kore');
      const secondaryVoice = typeof req.body?.secondaryVoice === 'string' && req.body.secondaryVoice ? req.body.secondaryVoice : 'Kore';
      const lengthStyle: 'quick' | 'standard' | 'detailed' =
        req.body?.lengthStyle === 'quick' || req.body?.lengthStyle === 'detailed'
          ? req.body.lengthStyle
          : 'standard';
      const language = typeof req.body?.language === 'string' && req.body.language ? req.body.language : 'English';
      const focusPrompt = typeof req.body?.focusPrompt === 'string' ? req.body.focusPrompt.trim() : '';

      if (sourceText.length < 20) {
        res.status(400).json({ error: 'Please provide at least a couple of sentences of article or note text to summarize.' });
        return;
      }

      const wordTarget =
        lengthStyle === 'quick'
          ? '130 to 180 words total (~1 minute listen)'
          : lengthStyle === 'detailed'
            ? '380 to 500 words total (~3.5 minutes listen)'
            : '230 to 320 words total (~2 minutes listen)';

      const systemInstruction =
        mode === 'podcast'
          ? `You are an executive commute audio producer creating an engaging two-host audio briefing between Alex (energetic lead host) and Sam (insightful analyst co-host).
Language requirement: Write the summaryText, keyTakeaways, and spoken dialogue in ${language}.
Target spoken length: ${wordTarget}.
Guidelines:
- Distill the key facts, context, and why it matters for someone listening hands-free on their commute.
- Alternate naturally between "Alex" and "Sam" (6 to 12 turns).
- You may occasionally include subtle natural speech cues supported by Gemini TTS such as <breath> or |yeah| or |mhm| sparingly for authentic podcast flow, without overusing them.
- Keep sentences crisp, conversational, and easy to follow by ear.`
          : `You are a world-class commute news and study briefing anchor.
Language requirement: Write the summaryText, keyTakeaways, and spoken script in ${language}.
Target spoken length: ${wordTarget}.
Guidelines:
- Deliver a clear, well-paced single-anchor audio summary ideal for listening during a commute.
- Return 2 to 5 coherent spoken segments in dialogueTurns with speaker set to "Alex".`;

      const userPrompt = [
        sourceTitle ? `Source Title: ${sourceTitle}` : '',
        focusPrompt ? `Listener Personalization / Focus: ${focusPrompt}` : '',
        `Source Material:\n${sourceText.slice(0, 32000)}`,
      ]
        .filter(Boolean)
        .join('\n\n');

      // Step 1: Generate structured summary & commute script with gemini-3.8-flash
      const summaryResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: 'Concise, engaging episode headline (max 110 chars).',
              },
              summaryText: {
                type: Type.STRING,
                description: 'Written executive summary paragraph (2-4 sentences).',
              },
              keyTakeaways: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 to 6 concise key takeaways.',
              },
              dialogueTurns: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    speaker: {
                      type: Type.STRING,
                      description: 'Must be "Alex" or "Sam".',
                    },
                    text: {
                      type: Type.STRING,
                      description: 'Spoken text for this turn without speaker prefix.',
                    },
                    style: {
                      type: Type.STRING,
                      description: 'Brief vocal delivery style cue.',
                    },
                  },
                  required: ['speaker', 'text'],
                },
              },
            },
            required: ['title', 'summaryText', 'keyTakeaways', 'dialogueTurns'],
          },
        },
      });

      const parsedJsonText = (summaryResponse.text ?? '{}').trim();
      const parsed = JSON.parse(parsedJsonText) as GeneratedScriptPayload;

      const rawTurns: DialogueTurn[] =
        Array.isArray(parsed.dialogueTurns) && parsed.dialogueTurns.length > 0
          ? parsed.dialogueTurns
          : [{ speaker: 'Alex', text: parsed.summaryText || sourceText.slice(0, 600) }];

      const normalizedTurns: DialogueTurn[] = rawTurns
        .map((t): DialogueTurn => ({
          speaker: t.speaker === 'Sam' && mode === 'podcast' ? 'Sam' : 'Alex',
          text: String(t.text || '').replace(/^(Alex|Sam)\s*:\s*/i, '').trim(),
          style: t.style ? String(t.style).slice(0, 100) : undefined,
        }))
        .filter((t) => t.text.length > 0);

      const scriptText =
        mode === 'podcast'
          ? normalizedTurns.map((t) => `${t.speaker}: ${t.text}`).join('\n\n')
          : normalizedTurns.map((t) => t.text).join('\n\n');

      // Step 2: Synthesize audio using required model gemini-3.8-flash-tts
      let ttsResponse;
      if (mode === 'podcast') {
        const distinctSecondVoice = secondaryVoice === primaryVoice
          ? (primaryVoice === 'Kore' ? 'Puck' : 'Kore')
          : secondaryVoice;

        ttsResponse = await ai.models.generateContent({
          model: 'gemini-3.8-flash-tts',
          contents: [
            {
              role: 'user',
              parts: normalizedTurns.map((turn) => ({
                text: `${turn.speaker}: ${turn.text}`,
                speechMetadata: {
                  speaker: turn.speaker,
                  style:
                    turn.style ||
                    (turn.speaker === 'Alex'
                      ? 'Warm, energetic commute podcast host'
                      : 'Clear, analytical co-host'),
                },
              })),
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: [
                  {
                    speaker: 'Alex',
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: primaryVoice },
                    },
                  },
                  {
                    speaker: 'Sam',
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: distinctSecondVoice },
                    },
                  },
                ],
              },
            },
          },
        });
      } else {
        ttsResponse = await ai.models.generateContent({
          model: 'gemini-3.8-flash-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: scriptText,
                  speechMetadata: {
                    style: 'Clear, articulate, engaging news briefing anchor',
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: primaryVoice },
              },
            },
          },
        });
      }

      const base64Audio =
        ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        res.status(502).json({ error: 'Gemini TTS did not return audio data. Please try again.' });
        return;
      }

      // Unary Gemini 3.8 TTS returns a complete 24kHz 16-bit mono WAV file
      const byteLength = Buffer.byteLength(base64Audio, 'base64');
      const durationSeconds = Math.max(1, Math.round(Math.max(0, byteLength - 44) / (24000 * 2)));

      const voiceInfo =
        mode === 'podcast'
          ? `Alex (${primaryVoice}) & Sam (${secondaryVoice === primaryVoice ? (primaryVoice === 'Kore' ? 'Puck' : 'Kore') : secondaryVoice})`
          : `${primaryVoice} (Anchor)`;

      res.json({
        title: (parsed.title || sourceTitle || 'Commute Audio Briefing').slice(0, 190),
        summaryText: (parsed.summaryText || scriptText.slice(0, 600)).slice(0, 9500),
        keyTakeaways: Array.isArray(parsed.keyTakeaways)
          ? parsed.keyTakeaways.slice(0, 8).map((item) => String(item).slice(0, 480))
          : [],
        scriptText: scriptText.slice(0, 19500),
        audioBase64: base64Audio,
        mimeType: 'audio/wav',
        durationSeconds,
        voiceInfo,
      });
    } catch (error) {
      console.error('Error in /api/audio-summary:', error);
      const rawMsg = error instanceof Error ? error.message : String(error);
      if (rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('PERMISSION_DENIED') || rawMsg.includes('GEMINI_API_KEY')) {
        res.status(403).json({
          error: 'Gemini API key issue detected. Please verify your API key in the Settings > Secrets panel.',
        });
        return;
      }
      if (rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.includes('429')) {
        res.status(429).json({
          error: 'Gemini API rate limit reached. Please wait a few seconds or select a billing-enabled key in Settings > Secrets.',
        });
        return;
      }
      res.status(500).json({ error: `Failed to generate audio summary: ${rawMsg}` });
    }
  });

  // Direct Text-to-Speech endpoint using gemini-3.8-flash-tts for reading any note aloud
  app.post('/api/tts', async (req: Request, res: Response) => {
    try {
      const ai = getGenAIClient();
      const text = typeof req.body?.text === 'string' ? req.body.text.trim().slice(0, 8000) : '';
      const voiceName = typeof req.body?.voiceName === 'string' && req.body.voiceName ? req.body.voiceName : 'Kore';

      if (!text) {
        res.status(400).json({ error: 'Text is required for speech synthesis.' });
        return;
      }

      const ttsResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text,
                speechMetadata: {
                  style: 'Clear, natural, steady study reader',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio =
        ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        res.status(502).json({ error: 'No audio returned from Gemini TTS.' });
        return;
      }

      const byteLength = Buffer.byteLength(base64Audio, 'base64');
      const durationSeconds = Math.max(1, Math.round(Math.max(0, byteLength - 44) / (24000 * 2)));

      res.json({
        audioBase64: base64Audio,
        mimeType: 'audio/wav',
        durationSeconds,
      });
    } catch (error) {
      const rawMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: `Speech generation failed: ${rawMsg}` });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StudyVault & Commute Audio Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
