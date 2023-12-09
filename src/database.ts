import setupKnex, { Knex } from "knex";
import { env } from "./env";

const { DATABASE_URL, DATABASE_CLIENT, DATABASE_MIGRATIONS_DIRECTORY } = env;

export const config: Knex.Config = {
  client: DATABASE_CLIENT,
  connection: {
    filename: DATABASE_URL,
  },
  useNullAsDefault: true,
  migrations: {
    extension: "ts",
    directory: DATABASE_MIGRATIONS_DIRECTORY,
  },
};
export const knex = setupKnex(config);