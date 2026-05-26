export interface VendorPreset {
  readonly baseURL: string;
  readonly defaultModel: string;
  readonly envKeyName: string; // human-doc hint, e.g. 'OPENAI_API_KEY' or 'DASHSCOPE_API_KEY'
  readonly docs: string;
}

export const VENDOR_PRESETS = {
  openai: {
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    envKeyName: 'OPENAI_API_KEY',
    docs: 'https://platform.openai.com/docs',
  },
  qwen: {
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    envKeyName: 'DASHSCOPE_API_KEY',
    docs: 'https://help.aliyun.com/zh/dashscope/developer-reference/compatibility-of-openai-with-dashscope',
  },
  deepseek: {
    baseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    envKeyName: 'DEEPSEEK_API_KEY',
    docs: 'https://api-docs.deepseek.com/',
  },
  mistral: {
    baseURL: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-large-latest',
    envKeyName: 'MISTRAL_API_KEY',
    docs: 'https://docs.mistral.ai/',
  },
  grok: {
    baseURL: 'https://api.x.ai/v1',
    defaultModel: 'grok-2-latest',
    envKeyName: 'XAI_API_KEY',
    docs: 'https://docs.x.ai/',
  },
  perplexity: {
    baseURL: 'https://api.perplexity.ai',
    defaultModel: 'sonar-pro',
    envKeyName: 'PERPLEXITY_API_KEY',
    docs: 'https://docs.perplexity.ai/',
  },
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    envKeyName: 'GROQ_API_KEY',
    docs: 'https://console.groq.com/docs',
  },
  ollama: {
    baseURL: 'http://localhost:11434/v1',
    defaultModel: 'llama3.2',
    envKeyName: 'OLLAMA_API_KEY (any non-empty string)',
    docs: 'https://github.com/ollama/ollama/blob/main/docs/openai.md',
  },
  custom: {
    baseURL: '',
    defaultModel: '',
    envKeyName: 'LLM_API_KEY',
    docs: 'configure via LLM_BASE_URL + LLM_MODEL + LLM_API_KEY',
  },
} as const satisfies Record<string, VendorPreset>;

export type VendorName = keyof typeof VENDOR_PRESETS;

export const VENDOR_NAMES: readonly VendorName[] = Object.keys(VENDOR_PRESETS) as VendorName[];
