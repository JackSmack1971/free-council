import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { NormalizedModelCapabilities, AgentPlan } from 'shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class RouterAgent {
  static async sampleAgents(
    query: string,
    models: NormalizedModelCapabilities[],
    k: number,
    apiKey: string,
    containsUpload: boolean = false
  ): Promise<AgentPlan> {
    // 1. Filter models to ensure we only present free models
    const freeModels = models.filter(m => m.is_free);

    // 2. Generate model card summaries representation for the prompt
    const cardSummariesText = freeModels.map(m => {
      const caps = [];
      if (m.coding) caps.push('coding');
      if (m.reasoning) caps.push('reasoning');
      if (m.vision) caps.push('vision');
      return `- Model ID: ${m.modelId}\n  Context Length: ${m.contextLength}\n  Capabilities: ${caps.join(', ') || 'general'}`;
    }).join('\n\n');

    // 3. Load prompt template
    let promptPath = path.resolve(__dirname, 'router/prompt.v1.txt');
    if (!fs.existsSync(promptPath)) {
      promptPath = path.resolve(__dirname, '../../src/agents/router/prompt.v1.txt');
    }

    let promptTemplate = '';
    try {
      promptTemplate = fs.readFileSync(promptPath, 'utf-8');
    } catch (err: any) {
      console.error(`[RouterAgent] Failed to read prompt template at ${promptPath}:`, err.message);
      // Hardcoded fallback template if file cannot be read
      promptTemplate = `You are the Meta-LLM Router for FreeCouncil. Select up to {{k}} models from available free models:\n{{cardSummaries}}\n\nQuery: {{query}}\n\nOutput valid JSON: {"agents": [{"role": "Coder"|"Analyst"|"Verifier"|"General"|"Fast"|"Vision", "modelId": "string"}], "totalApiCalls": number, "samplingRationale": "string"}`;
    }

    const prompt = promptTemplate
      .replace('{{k}}', String(k))
      .replace('{{cardSummaries}}', cardSummariesText)
      .replace('{{query}}', query);

    // 4. Call Meta-LLM
    const modelsToTry = [
      'inclusionai/ring-2.6-1t:free',
      'openrouter/free'
    ];

    let responseText = '';
    let usedModel = '';

    for (const model of modelsToTry) {
      try {
        console.log(`[RouterAgent] Calling Meta-LLM ${model}...`);
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'FreeCouncil'
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.0
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json() as any;
        responseText = data.choices?.[0]?.message?.content || '';
        usedModel = model;
        break; // Success!
      } catch (err: any) {
        console.warn(`[RouterAgent] Call to ${model} failed:`, err.message || err);
      }
    }

    // 5. Parse JSON and validate plan
    let parsedPlan: any = null;
    if (responseText) {
      try {
        // Strip markdown blocks if returned by the LLM
        let cleanText = responseText.trim();
        if (cleanText.startsWith('```')) {
          const matches = cleanText.match(/```(?:json)?([\s\S]*?)```/);
          if (matches && matches[1]) {
            cleanText = matches[1].trim();
          }
        }
        parsedPlan = JSON.parse(cleanText);
      } catch (err: any) {
        console.error('[RouterAgent] Failed to parse JSON response:', err.message, '\nResponse was:', responseText);
      }
    }

    // 6. Build the safe AgentPlan with fallback if parsing failed or was invalid
    const defaultAgent = freeModels[0]?.modelId || 'meta-llama/llama-3.3-70b-instruct:free';
    let agents: any[] = [];
    let totalApiCalls = 1;
    let samplingRationale = 'Fallback due to routing agent model response failure.';

    if (parsedPlan && Array.isArray(parsedPlan.agents)) {
      totalApiCalls = parsedPlan.totalApiCalls || 1;
      samplingRationale = parsedPlan.samplingRationale || 'Successfully sampled agents.';

      for (const item of parsedPlan.agents) {
        if (item && typeof item.modelId === 'string' && typeof item.role === 'string') {
          // Double check that model exists in active snapshot and is free
          const modelMatch = freeModels.find(m => m.modelId === item.modelId);
          if (modelMatch) {
            agents.push({
              role: item.role,
              modelId: item.modelId
            });
          } else {
            console.warn(`[RouterAgent] Filtered out non-free or unavailable model returned by LLM: ${item.modelId}`);
          }
        }
      }
    }

    // Fallback if no valid agents resolved from router LLM
    if (agents.length === 0 && !containsUpload) {
      console.warn('[RouterAgent] No valid agents could be resolved. Using default coding and reasoning agent fallback.');
      const codingModel = freeModels.find(m => m.coding)?.modelId || defaultAgent;
      const reasoningModel = freeModels.find(m => m.reasoning)?.modelId || defaultAgent;
      agents = [
        { role: 'Coder', modelId: codingModel },
        { role: 'Analyst', modelId: reasoningModel }
      ];
      totalApiCalls = 3;
      samplingRationale = 'Fallback defaults due to empty or invalid router response.';
    }

    // If the prompt contains uploads, force-inject a File Analyst agent
    if (containsUpload) {
      // Prefer owl-alpha (long-context). Fallback to any long-context free model.
      const analystModelId =
        freeModels.find(m => m.modelId === 'openrouter/owl-alpha')?.modelId ||
        freeModels.find(m => m.long_context)?.modelId ||
        (freeModels[0]?.modelId ?? 'openrouter/free');

      // Remove any existing Analyst role to avoid conflicts
      agents = agents.filter(a => a.role !== 'Analyst');

      // Prepend the File Analyst agent so it is the primary proposer
      agents.unshift({
        role: 'File Analyst',
        modelId: analystModelId
      });

      totalApiCalls = Math.max(totalApiCalls, agents.length + 1);
      samplingRationale = `File Analyst activated for upload-containing prompt. Model: ${analystModelId}. ${samplingRationale}`;
    }

    return {
      agents,
      totalApiCalls,
      samplingRationale,
      executionMode: 'goa_lite'
    };
  }
}
