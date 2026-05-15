import { readFileSync } from "fs";
import { resolve } from "path";

export function loadEnv() {
  try {
    const envFile = readFileSync(
      resolve(process.cwd(), ".env.local"),
      "utf-8" as BufferEncoding
    );
    for (const line of envFile.split("\n")) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) process.env[match[1].trim()] = match[2].trim();
    }
  } catch {}
}
