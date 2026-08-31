import { serve } from "@hono/node-server";
import { createHttpApp } from "./composition/create-http-app.js";
import { createRuntime } from "./composition/create-runtime.js";
import { localUrls } from "./composition/runtime-config.js";

const runtime = await createRuntime();
const app = createHttpApp(runtime);
const { hostname, port } = runtime.config;

serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`Space Runtime ready at ${localUrls(info.port).join(" · ")}`);
});
