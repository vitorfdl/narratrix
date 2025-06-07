import { AgentType, CreateAgentParams, UpdateAgentParams } from "@/schema/agent-schema";
import * as agentService from "@/services/agent-service";
import { AgentFilter } from "@/services/agent-service";
import { StoreApi, UseBoundStore, create } from "zustand";

interface AgentState {
  // State
  agents: AgentType[];
  isLoading: boolean;
  error: string | null;

  actions: {
    // CRUD Operations
    createAgent: (agentCreateData: CreateAgentParams) => Promise<AgentType>;
    getAgentById: (id: string) => Promise<AgentType | null>;
    updateAgent: (profile_id: string, id: string, updateData: UpdateAgentParams) => Promise<AgentType | null>;
    deleteAgent: (id: string) => Promise<boolean>;

    // List Operations
    fetchAgents: (profile_id: string, filter?: AgentFilter) => Promise<void>;

    // Utility Operations
    duplicateAgent: (id: string, newName: string) => Promise<AgentType | null>;

    // State Management
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    clearError: () => void;
    resetState: () => void;
  };
}

export const useAgentStore: UseBoundStore<StoreApi<AgentState>> = create<AgentState>((set, get) => ({
  // Initial State
  agents: [],
  isLoading: false,
  error: null,

  actions: {
    // CRUD Operations
    createAgent: async (agentCreateData: CreateAgentParams): Promise<AgentType> => {
      const { actions } = get();

      try {
        actions.setLoading(true);
        actions.clearError();

        const newAgent = await agentService.createAgent(agentCreateData);

        // Add the new agent to the current list
        set((state) => ({
          agents: [...state.agents, newAgent],
        }));

        return newAgent;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to create agent";
        actions.setError(errorMessage);
        throw error;
      } finally {
        actions.setLoading(false);
      }
    },

    getAgentById: async (id: string): Promise<AgentType | null> => {
      const { actions } = get();

      try {
        actions.setLoading(true);
        actions.clearError();

        const agent = await agentService.getAgentById(id);
        return agent;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to get agent";
        actions.setError(errorMessage);
        throw error;
      } finally {
        actions.setLoading(false);
      }
    },

    updateAgent: async (_profile_id: string, id: string, updateData: UpdateAgentParams): Promise<AgentType | null> => {
      const { actions } = get();

      try {
        actions.setLoading(true);
        actions.clearError();

        const updatedAgent = await agentService.updateAgent(id, updateData);

        if (updatedAgent) {
          // Update the agent in the current list
          set((state) => ({
            agents: state.agents.map((agent) => (agent.id === id ? updatedAgent : agent)),
          }));
        }

        return updatedAgent;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to update agent";
        actions.setError(errorMessage);
        throw error;
      } finally {
        actions.setLoading(false);
      }
    },

    deleteAgent: async (id: string): Promise<boolean> => {
      const { actions } = get();

      try {
        actions.setLoading(true);
        actions.clearError();

        const success = await agentService.deleteAgent(id);

        if (success) {
          // Remove the agent from the current list
          set((state) => ({
            agents: state.agents.filter((agent) => agent.id !== id),
          }));
        }

        return success;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to delete agent";
        actions.setError(errorMessage);
        throw error;
      } finally {
        actions.setLoading(false);
      }
    },

    // List Operations
    fetchAgents: async (profile_id: string, filter?: AgentFilter): Promise<void> => {
      const { actions } = get();

      try {
        actions.setLoading(true);
        actions.clearError();

        const agentFilter: AgentFilter = {
          profile_id,
          ...filter,
        };

        const agents = await agentService.listAgents(agentFilter);

        set({ agents });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch agents";
        actions.setError(errorMessage);
        throw error;
      } finally {
        actions.setLoading(false);
      }
    },

    // Utility Operations
    duplicateAgent: async (id: string, newName: string): Promise<AgentType | null> => {
      const { actions } = get();

      try {
        actions.setLoading(true);
        actions.clearError();

        const duplicatedAgent = await agentService.duplicateAgent(id, newName);

        if (duplicatedAgent) {
          // Add the duplicated agent to the current list
          set((state) => ({
            agents: [...state.agents, duplicatedAgent],
          }));
        }

        return duplicatedAgent;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to duplicate agent";
        actions.setError(errorMessage);
        throw error;
      } finally {
        actions.setLoading(false);
      }
    },
    // State Management
    setLoading: (loading: boolean): void => {
      set({ isLoading: loading });
    },

    setError: (error: string | null): void => {
      set({ error });
    },

    clearError: (): void => {
      set({ error: null });
    },

    resetState: (): void => {
      set({
        agents: [],
        isLoading: false,
        error: null,
      });
    },
  },
}));

export const useAgents = () => useAgentStore((state) => state.agents);
export const useAgentLoading = () => useAgentStore((state) => state.isLoading);
export const useAgentError = () => useAgentStore((state) => state.error);
export const useAgentActions = () => useAgentStore((state) => state.actions);
