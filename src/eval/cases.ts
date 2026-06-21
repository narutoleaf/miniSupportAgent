export type EvalCase = {
  name: string;
  description: string;
  turns: string[];
  assertions: {
    responseContainsAny?: string[][];
    toolsCalled?: string[];
    memoryKeysExist?: string[];
    toolErrorLogged?: boolean;
    contextSummarized?: boolean;
  };
  simulateFailure?: boolean;
  recentTurnsOverride?: number;
};

export const evalCases: EvalCase[] = [
  {
    name: "order_lookup_found",
    description: "Look up an existing order and get status info",
    turns: ["Can you check order ORD-001 for me?"],
    assertions: {
      responseContainsAny: [["ORD-001"], ["delivered", "Delivered"]],
      toolsCalled: ["lookupOrderStatus"],
    },
  },
  {
    name: "order_lookup_not_found",
    description: "Look up a non-existent order gracefully",
    turns: ["What's the status of order ORD-999?"],
    assertions: {
      responseContainsAny: [["ORD-999"]],
      toolsCalled: ["lookupOrderStatus"],
    },
  },
  {
    name: "tool_chain_lost_order_escalation",
    description: "Lost order triggers automatic escalation to human agent",
    turns: ["I need help with order ORD-003"],
    assertions: {
      responseContainsAny: [["ORD-003"], ["lost", "escalat", "ticket", "TK-", "support"]],
      toolsCalled: ["lookupOrderStatus", "escalateToHuman"],
    },
  },
  {
    name: "inventory_check",
    description: "Check product stock level",
    turns: ["Check inventory for SKU-100 across all stores"],
    assertions: {
      responseContainsAny: [["SKU-100", "T-shirt", "t-shirt"]],
      toolsCalled: ["checkInventory"],
    },
  },
  {
    name: "inventory_out_of_stock",
    description: "Check a product that is out of stock",
    turns: ["Check stock for SKU-101 across all stores please"],
    assertions: {
      responseContainsAny: [["SKU-101", "Jeans", "jeans"]],
      toolsCalled: ["checkInventory"],
    },
  },
  {
    name: "store_info",
    description: "Get store address and hours",
    turns: ["What are the hours for the HCM store? The store ID is store-hcm"],
    assertions: {
      responseContainsAny: [["08:00", "22:00", "8:00"]],
      toolsCalled: ["getStoreInfo"],
    },
  },
  {
    name: "memory_extraction",
    description: "Agent remembers customer preferences mentioned mid-conversation",
    turns: [
      "My name is David and I always prefer email over phone for contact.",
      "Can you check order ORD-002 for me?",
    ],
    assertions: {
      memoryKeysExist: ["customer_name", "preferred_contact"],
      toolsCalled: ["lookupOrderStatus"],
    },
  },
  {
    name: "graceful_tool_failure",
    description: "Tool failure is handled gracefully without crashing",
    turns: ["Can you check order ORD-001?"],
    assertions: {
      toolErrorLogged: true,
    },
    simulateFailure: true,
  },
  {
    name: "multi_turn_context",
    description: "Agent maintains context across multiple turns in the conversation",
    turns: [
      "Check inventory for SKU-102 across all stores",
      "Which store has that product?",
    ],
    assertions: {
      responseContainsAny: [["Hanoi", "store-hn", "HN"]],
      toolsCalled: ["checkInventory"],
    },
  },
  {
    name: "multi_tool_single_conversation",
    description: "Use multiple different tools in one conversation",
    turns: [
      "Check order ORD-004 for me.",
      "Also what's the Da Nang store phone number? Store ID is store-dn",
    ],
    assertions: {
      responseContainsAny: [["0236"]],
      toolsCalled: ["lookupOrderStatus", "getStoreInfo"],
    },
  },
  {
    name: "context_reconstruction_summarization",
    description: "Long conversation triggers summarization of old turns within token budget",
    turns: [
      "Hi, my name is Alex.",
      "Check order ORD-001 for me.",
      "What about ORD-002?",
      "Is SKU-100 in stock?",
      "What are the Da Nang store hours? Store ID is store-dn",
    ],
    assertions: {
      contextSummarized: true,
      memoryKeysExist: ["customer_name"],
    },
    recentTurnsOverride: 2,
  },
];
