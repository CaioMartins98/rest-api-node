import { FastifyInstance, FastifyRequest } from "fastify";
import { knex } from "../database";
import { z } from "zod";
import crypto, { randomUUID } from "node:crypto";
import { checkSessionIdExists } from "../middlewares/check-session-id-exists";

const createTransactionBodySchema = z.object({
  title: z.string(),
  amount: z.number(),
  type: z.enum(["credit", "debit"]),
});

const updateTransactionBodySchema = z.object({
  title: z.string(),
  amount: z.number(),
  type: z.enum(["credit", "debit"]),
});

const transactionParamsSchema = z.object({
  id: z.string().uuid(),
});

const transactionQuerySchema = z.object({
  search: z.string().nullable(),
});

// Cookies <-> Formas de manter contexto entre as req

export async function transactionsRoutes(app: FastifyInstance) {
  //CREATE
  app.post("/", async (req, res) => {
    const body = createTransactionBodySchema.parse(req.body);
    const { title, amount, type } = body;

    let sessionId = req.cookies.sessionId;

    if (!sessionId) {
      sessionId = randomUUID();
      res.cookie("sessionId", sessionId, {
        path: "/",
        maxAge: 1000 * 60 * 60 * 24 * 7, //7 dias (1000 milisegundos * 60 segundos * 60 minutos * 24 horas * 7 dias)
      });
    }

    await knex("transactions").insert({
      id: crypto.randomUUID(),
      title,
      amount: type === "credit" ? amount : amount * -1,
      type,
      session_id: sessionId,
    });

    return res.status(201).send();
  });

  //READ
  app.get("/", { preHandler: [checkSessionIdExists] }, async (req, res) => {
    const { sessionId } = req.cookies;
    const transactions = await knex("transactions")
      .where("session_id", sessionId)
      .select();
    return res.status(200).send({ transactions });
  });

  //VIEW TRANSACTION
  app.get("/:id", { preHandler: [checkSessionIdExists] }, async (req, res) => {
    const params = transactionParamsSchema.parse(req.params);
    const { id } = params;
    const transaction = await knex("transactions")
      .select()
      .where("id", id)
      .first();
    return res.status(200).send({ transaction });
  });

  //UPDATE
  app.put("/:id", { preHandler: [checkSessionIdExists] }, async (req, res) => {
    const body = updateTransactionBodySchema.parse(req.body);
    const params = transactionParamsSchema.parse(req.params);
    const { title, amount, type } = body;
    const { id } = params;
    await knex("transactions")
      .update({
        title,
        type,
        amount: type === "credit" ? amount : amount * -1,
      })
      .where("id", id);

    return res.status(200).send();
  });

  //DELETE
  app.delete(
    "/:id",
    { preHandler: [checkSessionIdExists] },
    async (req, res) => {
      const params = transactionParamsSchema.parse(req.params);
      const { id } = params;
      await knex("transactions").delete().where("id", id);
      return res.status(200).send();
    },
  );

  //GET RESUME
  app.get(
    "/resume",
    { preHandler: [checkSessionIdExists] },
    async (req, res) => {
      const { sessionId } = req.cookies;
      const total = await knex("transactions")
        .where("session_id", sessionId)
        .sum("amount", { as: "total" })
        .first();

      const debit = await knex("transactions")
        .where({ session_id: sessionId, type: "debit" })
        .sum("amount", { as: "debit" })
        .first();

      const credit = await knex("transactions")
        .where({ session_id: sessionId, type: "credit" })
        .sum("amount", { as: "credit" })
        .first();
      const summary = {
        total: total?.total,
        debit: debit?.debit,
        credit: credit?.credit,
      };
      return res.status(200).send({ summary });
    },
  );
}
