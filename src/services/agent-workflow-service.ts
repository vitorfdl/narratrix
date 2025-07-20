import { AgentEdgeType, AgentNodeType, AgentType } from "@/schema/agent-schema";

/**
 * Workflow execution context for tracking state during execution
 */
export interface WorkflowExecutionContext {
  agentId: string;
  nodeValues: Map<string, any>;
  executedNodes: Set<string>;
  isRunning: boolean;
  currentNodeId?: string;
}

/**
 * Node execution result
 */
export interface NodeExecutionResult {
  success: boolean;
  value?: any;
  error?: string;
}

/**
 * Workflow execution service for agents
 */
export class AgentWorkflowService {
  private executionContexts = new Map<string, WorkflowExecutionContext>();

  /**
   * Execute an agent workflow
   */
  async executeWorkflow(
    agent: AgentType,
    initialInput?: string,
    onNodeExecuted?: (nodeId: string, result: NodeExecutionResult) => void,
  ): Promise<string | null> {
    console.log(`Starting workflow execution for agent: ${agent.name} (${agent.id})`);
    console.log(`Agent has ${agent.nodes.length} nodes and ${agent.edges.length} edges`);

    const context: WorkflowExecutionContext = {
      agentId: agent.id,
      nodeValues: new Map(),
      executedNodes: new Set(),
      isRunning: true,
    };

    this.executionContexts.set(agent.id, context);

    try {
      // Find entry points (nodes with no incoming edges or chatInput nodes)
      const entryNodes = this.findEntryNodes(agent.nodes, agent.edges);
      console.log(`Found ${entryNodes.length} entry nodes:`, entryNodes);

      if (entryNodes.length === 0) {
        throw new Error("No entry points found in workflow");
      }

      // Set initial input if provided
      if (initialInput) {
        context.nodeValues.set("workflow-input", initialInput);
        console.log(`Set initial input: ${initialInput}`);
      }

      // Execute nodes in topological order
      const executionOrder = this.getTopologicalOrder(agent.nodes, agent.edges);
      console.log(`Execution order: ${executionOrder}`);

      for (const nodeId of executionOrder) {
        if (!context.isRunning) {
          break;
        }

        const node = agent.nodes.find((n) => n.id === nodeId);
        if (!node) {
          continue;
        }

        context.currentNodeId = nodeId;
        const result = await this.executeNode(node, agent.edges, context);

        onNodeExecuted?.(nodeId, result);

        if (!result.success) {
          throw new Error(`Node ${nodeId} execution failed: ${result.error}`);
        }

        context.executedNodes.add(nodeId);
        if (result.value !== undefined) {
          context.nodeValues.set(nodeId, result.value);
        }
      }

      // Find output nodes and return their values
      const outputNodes = agent.nodes.filter((n) => n.type === "chatOutput");
      console.log(`Found ${outputNodes.length} output nodes`);
      if (outputNodes.length > 0) {
        const outputNodeId = outputNodes[0].id;
        const result = context.nodeValues.get(outputNodeId) || null;
        console.log(`Workflow completed with result: ${result}`);
        return result;
      }

      console.log("Workflow completed with no output");
      return null;
    } catch (error) {
      console.error("Workflow execution failed:", error);
      throw error;
    } finally {
      context.isRunning = false;
      this.executionContexts.delete(agent.id);
    }
  }

  /**
   * Execute a single node
   */
  private async executeNode(node: AgentNodeType, edges: AgentEdgeType[], context: WorkflowExecutionContext): Promise<NodeExecutionResult> {
    try {
      console.log(`Executing node: ${node.id} (type: ${node.type})`);

      // Get input values for this node
      const inputs = this.getNodeInputs(node, edges, context);
      console.log(`Node ${node.id} inputs:`, inputs);

      switch (node.type) {
        case "agent":
          return await this.executeAgentNode(node, inputs, context);
        case "chatHistory":
          return await this.executeChatHistoryNode(node, inputs, context);
        case "chatOutput":
          return await this.executeChatOutputNode(node, inputs, context);
        case "chatInput":
          return await this.executeChatInputNode(node, inputs, context);
        default:
          console.warn(`Unknown node type: ${node.type}`);
          return {
            success: false,
            error: `Unknown node type: ${node.type}`,
          };
      }
    } catch (error) {
      console.error(`Error executing node ${node.id}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Execute an agent node (LLM inference)
   */
  private async executeAgentNode(node: AgentNodeType, inputs: Record<string, any>, _context: WorkflowExecutionContext): Promise<NodeExecutionResult> {
    const config = node.config as any;

    // Get input prompt
    let inputPrompt = config.inputPrompt || "{{input}}";
    if (inputs.input) {
      inputPrompt = inputPrompt.replace("{{input}}", inputs.input);
    }

    // Use the inference service to generate response
    // Note: This is a simplified version - in a real implementation,
    // you'd need to properly integrate with the inference service
    try {
      // For now, return a placeholder response
      // TODO: Integrate with actual inference service
      const response = `Agent response for: ${inputPrompt}`;

      return {
        success: true,
        value: response,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Agent execution failed",
      };
    }
  }

  /**
   * Execute a chat history node
   */
  private async executeChatHistoryNode(
    _node: AgentNodeType,
    _inputs: Record<string, any>,
    _context: WorkflowExecutionContext,
  ): Promise<NodeExecutionResult> {
    // TODO: Implement chat history retrieval
    return {
      success: true,
      value: [], // Empty message list for now
    };
  }

  /**
   * Execute a chat output node
   */
  private async executeChatOutputNode(
    _node: AgentNodeType,
    inputs: Record<string, any>,
    _context: WorkflowExecutionContext,
  ): Promise<NodeExecutionResult> {
    const response = inputs.response || "";
    return {
      success: true,
      value: response,
    };
  }

  /**
   * Execute a chat input node
   */
  private async executeChatInputNode(
    _node: AgentNodeType,
    _inputs: Record<string, any>,
    context: WorkflowExecutionContext,
  ): Promise<NodeExecutionResult> {
    // Get initial input from context
    const workflowInput = context.nodeValues.get("workflow-input") || "";
    return {
      success: true,
      value: workflowInput,
    };
  }

  /**
   * Get input values for a node from connected edges
   */
  private getNodeInputs(node: AgentNodeType, edges: AgentEdgeType[], context: WorkflowExecutionContext): Record<string, any> {
    const inputs: Record<string, any> = {};

    // Find all edges that target this node
    const incomingEdges = edges.filter((edge) => edge.target === node.id);

    for (const edge of incomingEdges) {
      const sourceValue = context.nodeValues.get(edge.source);
      if (sourceValue !== undefined) {
        // Map the edge target handle to input name
        const inputName = this.mapHandleToInputName(edge.targetHandle);
        inputs[inputName] = sourceValue;
      }
    }

    return inputs;
  }

  /**
   * Map handle names to input names
   */
  private mapHandleToInputName(handle: string): string {
    const mapping: Record<string, string> = {
      "in-input": "input",
      "in-history": "history",
      "in-system-prompt": "systemPrompt",
      response: "response",
      "in-character": "characterId",
    };
    return mapping[handle] || handle;
  }

  /**
   * Find entry nodes (nodes with no incoming edges)
   */
  private findEntryNodes(nodes: AgentNodeType[], edges: AgentEdgeType[]): string[] {
    const nodesWithIncoming = new Set(edges.map((edge) => edge.target));
    return nodes.filter((node) => !nodesWithIncoming.has(node.id) || node.type === "chatInput").map((node) => node.id);
  }

  /**
   * Get topological order for node execution
   */
  private getTopologicalOrder(nodes: AgentNodeType[], edges: AgentEdgeType[]): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: string[] = [];

    const visit = (nodeId: string) => {
      if (visiting.has(nodeId)) {
        throw new Error(`Circular dependency detected involving node ${nodeId}`);
      }
      if (visited.has(nodeId)) {
        return;
      }

      visiting.add(nodeId);

      // Visit all dependencies first
      const dependencies = edges.filter((edge) => edge.target === nodeId).map((edge) => edge.source);

      for (const depId of dependencies) {
        visit(depId);
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
      result.push(nodeId);
    };

    // Visit all nodes
    for (const node of nodes) {
      if (!visited.has(node.id)) {
        visit(node.id);
      }
    }

    return result;
  }

  /**
   * Cancel workflow execution
   */
  cancelWorkflow(agentId: string): void {
    const context = this.executionContexts.get(agentId);
    if (context) {
      context.isRunning = false;
    }
  }

  /**
   * Check if workflow is running
   */
  isWorkflowRunning(agentId: string): boolean {
    const context = this.executionContexts.get(agentId);
    return context?.isRunning || false;
  }
}

// Export singleton instance
export const agentWorkflowService = new AgentWorkflowService();
