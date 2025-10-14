import { pgTable, serial, varchar, text } from "drizzle-orm/pg-core";

export const customerAddresses = pgTable("customer_addresses", {
  id: serial("id").primaryKey(),
  first_name: varchar("first_name", { length: 100 }).notNull(),
  last_name: varchar("last_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  res_address: text("res_address"),
  work_address: text("work_address"),
  country: varchar("country", { length: 100 }),
  state: varchar("state", { length: 100 }),
  phone_1: varchar("phone_1", { length: 20 }),
  phone_2: varchar("phone_2", { length: 20 }),
});

export type CustomerAddress = typeof customerAddresses.$inferSelect;
export type NewCustomerAddress = typeof customerAddresses.$inferInsert;
