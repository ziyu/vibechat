import { renderDocument } from "./page.js";
import { registry } from "./runtime.js";

registry.start();

export default function fetch() {
  return new Response(renderDocument(), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
