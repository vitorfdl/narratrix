export type ModelType = 'text' | 'image' | 'audio' | 'database' | 'speech';

export interface Model {
    id: string;
    name: string;
    description: string;
    type: ModelType;
    endpoint: string;
    icon?: string;
    isEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface ModelGroup {
    type: ModelType;
    title: string;
    models: Model[];
}

// Mock data
export const mockModels: ModelGroup[] = [
    {
        type: 'text',
        title: 'Text Inference Models',
        models: [
            {
                id: '1',
                name: 'OpenAI',
                description: 'Chat Completion',
                type: 'text',
                endpoint: 'api.openai.com/v1/chat/completions',
                isEnabled: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: '2',
                name: 'OpenAI Test',
                description: 'Chat Completion',
                type: 'text',
                endpoint: 'api.openai.com/v1/chat/completions',
                isEnabled: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: '5',
                name: 'OpenAI Test',
                description: 'Chat Completion',
                type: 'text',
                endpoint: 'api.openai.com/v1/chat/completions',
                isEnabled: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: '3',
                name: 'OpenAI Test',
                description: 'Chat Completion',
                type: 'text',
                endpoint: 'api.openai.com/v1/chat/completions',
                isEnabled: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: '4',
                name: 'OpenAI Test',
                description: 'Chat Completion',
                type: 'text',
                endpoint: 'api.openai.com/v1/chat/completions',
                isEnabled: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ],
    },
    {
        type: 'image',
        title: 'Image Inference Models',
        models: [
            {
                id: '2',
                name: 'ComfyUI',
                description: 'Endpoint',
                type: 'image',
                endpoint: 'localhost:3000/api/generate',
                isEnabled: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ],
    },
    {
        type: 'speech',
        title: 'Text to Speech Models',
        models: [
            {
                id: '3',
                name: 'ElevenLabs',
                description: 'Endpoint',
                type: 'speech',
                endpoint: 'api.elevenlabs.io/v1/text-to-speech',
                isEnabled: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ],
    },
]; 