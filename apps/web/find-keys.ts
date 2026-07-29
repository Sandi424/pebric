import * as fs from "fs";
import * as path from "path";

console.log("Environment variables keys:", Object.keys(process.env).filter(k => !k.includes("PATH")));

// Check if there are any other .env files
const dirsToSearch = ["c:\\Users\\sandi\\Downloads\\sudipweb", "c:\\Users\\sandi\\.gemini"];
for (const dir of dirsToSearch) {
  try {
    const files = fs.readdirSync(dir);
    console.log(`Files in ${dir}:`, files.filter(f => f.includes("env") || f.includes("sql") || f.includes("config") || f.includes("key")));
  } catch (e) {}
}
