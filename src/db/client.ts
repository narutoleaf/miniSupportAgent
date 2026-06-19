import { Pool } from "pg";
import "dotenv/config";

export const db = new Pool({
  host: process.env.POSTGRES_HOST ?? "localhost",
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  database: process.env.POSTGRES_DB ?? "store_agent",
  user: process.env.POSTGRES_USER ?? "agent_user",
  password: process.env.POSTGRES_PASSWORD ?? "agent_pass",
});
