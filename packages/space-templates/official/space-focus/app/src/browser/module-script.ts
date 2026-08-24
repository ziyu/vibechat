interface SerializableFunction {
  toString(): string;
}

interface ModuleScriptOptions {
  attributes?: string[];
  imports: string[];
  functions: SerializableFunction[];
  bootstrap: string;
}

/**
 * AgentOS serves an App Project through its fetch handler rather than a static
 * asset directory. Browser behavior stays in type-checked TypeScript functions;
 * this adapter emits those functions as one ES module in the returned document.
 */
export function renderModuleScript(options: ModuleScriptOptions) {
  const attributes = options.attributes?.length
    ? ` ${options.attributes.join(" ")}`
    : "";
  const source = [
    ...options.imports,
    ...options.functions.map((item) => item.toString()),
    options.bootstrap,
  ].join("\n\n");

  return `<script type="module"${attributes}>\n${source}\n</script>`;
}
