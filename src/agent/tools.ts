import { tool } from "ai";
import { z } from "zod";
import { logToolCall } from "../db/queries";

// ── Simulated data ────────────────────────────────────────────────────────────

const ORDERS: Record<string, { status: string; customer: string; items: string[]; total: number; date: string }> = {
  "ORD-001": { status: "delivered", customer: "Nguyen Van A", items: ["White T-shirt x2", "Jeans x1"], total: 850000, date: "2026-06-15" },
  "ORD-002": { status: "shipping", customer: "Tran Thi B", items: ["Sneakers x1"], total: 1200000, date: "2026-06-18" },
  "ORD-003": { status: "lost", customer: "Le Van C", items: ["Laptop backpack x1", "Wireless mouse x1"], total: 650000, date: "2026-06-10" },
  "ORD-004": { status: "processing", customer: "Pham Thi D", items: ["Smartwatch x1"], total: 3500000, date: "2026-06-19" },
};

const INVENTORY: Record<string, { name: string; stock: number; store: string }> = {
  "SKU-100": { name: "White T-shirt", stock: 45, store: "store-hcm" },
  "SKU-101": { name: "Jeans", stock: 0, store: "store-hcm" },
  "SKU-102": { name: "Sneakers", stock: 12, store: "store-hn" },
  "SKU-103": { name: "Laptop backpack", stock: 5, store: "store-hcm" },
  "SKU-104": { name: "Smartwatch", stock: 3, store: "store-dn" },
};

const STORES: Record<string, { name: string; address: string; phone: string; hours: string }> = {
  "store-hcm": { name: "HCM Store", address: "123 Nguyen Hue, Q1, HCMC", phone: "028-1234-5678", hours: "08:00 - 22:00" },
  "store-hn": { name: "Hanoi Store", address: "45 Pho Hue, Hai Ba Trung, HN", phone: "024-9876-5432", hours: "08:30 - 21:30" },
  "store-dn": { name: "Da Nang Store", address: "78 Bach Dang, Hai Chau, DN", phone: "0236-111-2222", hours: "09:00 - 21:00" },
};

// ── Tool executor wrapper with Postgres logging ──────────────────────────────

function withLogging<T>(
  conversationId: string,
  toolName: string,
  input: unknown,
  fn: () => T | Promise<T>
): Promise<T> {
  const start = Date.now();
  return Promise.resolve()
    .then(() => fn())
    .then(async (result) => {
      await logToolCall(conversationId, toolName, input, result, null, Date.now() - start);
      return result;
    })
    .catch(async (err: Error) => {
      await logToolCall(conversationId, toolName, input, null, err.message, Date.now() - start);
      throw err;
    });
}

// ── Failure simulation toggle ─────────────────────────────────────────────────

let _simulateFailure = false;
export function setSimulateFailure(v: boolean) { _simulateFailure = v; }

// ── Tool definitions ──────────────────────────────────────────────────────────

export function createTools(conversationId: string) {
  return {
    lookupOrderStatus: tool({
      description: "Look up order status by order ID. If the order is lost or has a serious issue, automatically call escalateToHuman.",
      parameters: z.object({
        orderId: z.string().describe("Order ID, e.g. ORD-001"),
      }),
      execute: async ({ orderId }) => {
        return withLogging(conversationId, "lookupOrderStatus", { orderId }, () => {
          if (_simulateFailure) {
            throw new Error("Service unavailable: order tracking system is down");
          }
          const order = ORDERS[orderId];
          if (!order) return { found: false, message: `Order ${orderId} not found` };
          return { found: true, ...order, orderId };
        });
      },
    }),

    checkInventory: tool({
      description: "Check product stock level by SKU. Optionally filter by store.",
      parameters: z.object({
        productId: z.string().describe("Product SKU, e.g. SKU-100"),
        storeId: z.string().optional().describe("Store ID, e.g. store-hcm"),
      }),
      execute: async ({ productId, storeId }) => {
        return withLogging(conversationId, "checkInventory", { productId, storeId }, () => {
          if (_simulateFailure) {
            throw new Error("Database connection timeout: inventory service unavailable");
          }
          const item = INVENTORY[productId];
          if (!item) return { found: false, message: `Product ${productId} not found` };
          if (storeId && item.store !== storeId) {
            return { found: true, name: item.name, stock: 0, store: storeId, message: "Product not available at this store" };
          }
          return { found: true, ...item, productId };
        });
      },
    }),

    getStoreInfo: tool({
      description: "Get store information: address, phone number, opening hours.",
      parameters: z.object({
        storeId: z.string().describe("Store ID, e.g. store-hcm, store-hn, store-dn"),
      }),
      execute: async ({ storeId }) => {
        return withLogging(conversationId, "getStoreInfo", { storeId }, () => {
          const store = STORES[storeId];
          if (!store) return { found: false, message: `Store ${storeId} not found` };
          return { found: true, ...store, storeId };
        });
      },
    }),

    escalateToHuman: tool({
      description: "Escalate issue to a human support agent. Use when an order is lost, customer requests it, or the issue cannot be resolved automatically.",
      parameters: z.object({
        reason: z.string().describe("Reason for escalation"),
        orderId: z.string().optional().describe("Related order ID if applicable"),
        priority: z.enum(["low", "medium", "high"]).default("medium").describe("Priority level"),
      }),
      execute: async ({ reason, orderId, priority }) => {
        return withLogging(conversationId, "escalateToHuman", { reason, orderId, priority }, () => {
          const ticketId = `TK-${Date.now().toString(36).toUpperCase()}`;
          return {
            success: true,
            ticketId,
            message: `Created support ticket ${ticketId} with ${priority} priority. An agent will follow up within ${priority === "high" ? "15 minutes" : priority === "medium" ? "1 hour" : "4 hours"}.`,
          };
        });
      },
    }),
  };
}
