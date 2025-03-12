export type BaseModel = {
    id: string;
    name: string;
    author: string;
    tags: string[];
    avatar: string;
    expressionPackPath: string;
    createdAt: Date;
    updatedAt: Date;
};

export type Character = BaseModel & {
    type: 'character';
    personality: string;
    customSystemPrompt?: string;
    preserveLastResponse?: boolean;
};

export type Agent = BaseModel & {
    type: 'agent';
    systemPrompt: string;
    lorebooks?: string[];
};

export type CharacterOrAgent = Character | Agent;

export type SortOption = {
    field: 'name' | 'type' | 'updatedAt';
    direction: 'asc' | 'desc';
};

export type ViewSettings = {
    cardsPerRow: number;
    cardSize: 'small' | 'medium' | 'large';
};

// Mock data
export const mockCharactersAndAgents: CharacterOrAgent[] = [
    {
        id: '1',
        type: 'character',
        name: 'Narratrix',
        author: 'Narratrix Team',
        tags: ['female', 'technician'],
        avatar: '/avatars/narratrix.jpeg',
        expressionPackPath: '/expressions/ash',
        personality: 'Energetic and determined Pokemon trainer',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
    },
    {
        id: '2',
        type: 'agent',
        name: 'Research Assistant',
        author: 'Admin',
        tags: ['academic', 'helper', 'research'],
        avatar: '/avatars/assistant.png',
        expressionPackPath: '/expressions/assistant',
        systemPrompt: 'You are a helpful research assistant...',
        lorebooks: ['academic_guidelines', 'research_methods'],
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
    },
    // Add more mock data as needed
]; 