import { createVaultServer } from "../server-dist/runtime.mjs";

const { app } = createVaultServer();
app.set("trust proxy", 1);

export default app;
