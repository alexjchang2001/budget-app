import Anthropic from "@anthropic-ai/sdk";

export type ParsedSchedule = {
  shift_count: number;
  shift_days: string[];
  confidence: number;
};

export class ParseFailedError extends Error {
  constructor() {
    super("schedule_parse_failed");
  }
}

const SYSTEM_PROMPT = `You are parsing a restaurant employee scheduling app screenshot.
Extract the total number of shifts and the day of week for each shift.
Days must be full names: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday.
Return JSON only: { "shift_count": <int>, "shift_days": <array of day strings>, "confidence": <float 0-1> }
Do not include any explanation or markdown outside the JSON object.`;

function stripFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function validate(parsed: unknown): ParsedSchedule {
  if (typeof parsed !== "object" || parsed === null) throw new ParseFailedError();
  const p = parsed as Record<string, unknown>;
  if (typeof p.shift_count !== "number" || !Number.isInteger(p.shift_count)) throw new ParseFailedError();
  if (!Array.isArray(p.shift_days) || !p.shift_days.every((d) => typeof d === "string")) throw new ParseFailedError();
  if (typeof p.confidence !== "number") throw new ParseFailedError();
  return { shift_count: p.shift_count, shift_days: p.shift_days as string[], confidence: p.confidence };
}

export async function parseScheduleImage(buffer: Buffer, mimeType: string): Promise<ParsedSchedule> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const validMime = (mimeType === "image/jpeg" || mimeType === "image/png" || mimeType === "image/gif" || mimeType === "image/webp")
    ? mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp"
    : "image/jpeg";

  let raw: string;
  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: [{
          type: "image",
          source: { type: "base64", media_type: validMime, data: buffer.toString("base64") },
        }, {
          type: "text",
          text: "Parse this schedule screenshot and return the JSON.",
        }],
      }],
    });
    const block = response.content[0];
    raw = block.type === "text" ? block.text : "";
  } catch {
    throw new ParseFailedError();
  }

  try {
    return validate(JSON.parse(stripFences(raw)));
  } catch {
    throw new ParseFailedError();
  }
}
