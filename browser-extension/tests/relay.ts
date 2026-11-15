import supertest from "../../threadcheck/node_modules/supertest/index.js";
import { createApp } from "../../threadcheck/server/app";
import { testDatabase, vaultOptions } from "../../threadcheck/tests/database";
const fixture = await testDatabase();
const app = createApp(fixture.store, "654321", null, vaultOptions);
const paired = await supertest(app).post("/api/pair").send({ code: "654321" });
app.get("/__test/session", (_request, response) =>
  response.json({ url: "http://127.0.0.1:4321", token: paired.body.token }),
);
const server = app.listen(4321, "127.0.0.1");
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () =>
    server.close(async () => {
      await fixture.close();
      process.exit(0);
    }),
  );
