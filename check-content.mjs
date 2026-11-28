import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { compile } from "@mdx-js/mdx";
import yaml from "js-yaml";

async function* pages(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) yield* pages(file);
    else if (entry.isFile() && [".md", ".mdx"].includes(extname(file))) yield file;
    else throw new Error(`Unexpected entry: ${file}`);
  }
}

for (const directory of ["src/content", "public/agent-setup"]) {
  let count = 0;
  for await (const file of pages(directory)) {
    const source = await readFile(file, "utf8");
    const header = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
    try {
      if (directory === "src/content" && !yaml.load(header?.[1] ?? "")?.title) {
        throw new Error("Expected a title in the YAML front matter");
      }
      await compile({ path: file, value: source.slice(header?.[0].length ?? 0) }, {
        format: file.endsWith(".mdx") ? "mdx" : "md",
      });
    } catch (error) {
      throw new Error(`${file}: ${error.message}`, { cause: error });
    }
    count++;
  }
  if (!count) throw new Error(`No documents in ${directory}`);
  console.log(`Checked ${count} documents in ${directory}`);
}
