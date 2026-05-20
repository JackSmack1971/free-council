import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROMPT_VERSION = 'v1';

export function loadAggregatorPrompt(): string {
  const promptPath = path.resolve(__dirname, 'agg_prompt.v1.txt');
  return fs.readFileSync(promptPath, 'utf-8');
}

export function renderAggregatorPrompt(
  proposers: Array<{ role: string; modelId: string; response: string }>,
  originalPrompt: string,
  attachmentsContext: string = ''
): string {
  const template = loadAggregatorPrompt();

  const numberedList = proposers
    .map((p, i) => `${i + 1}. ${p.role} (${p.modelId}):\n${p.response}`)
    .join('\n\n');

  return template
    .replace('{numbered_list_with_role_model}', numberedList)
    .replace('{original_prompt}', originalPrompt)
    .replace('{attachments_context_if_any}', attachmentsContext);
}
