import { spawn } from "node:child_process";

const children = [
  spawn("npm", ["run", "server"], { stdio: "inherit" }),
  spawn("npx", ["expo", "start", "--web"], { stdio: "inherit" }),
];
function stop(signal = "SIGTERM") {
  for (const child of children) child.kill(signal);
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => stop(signal));
for (const child of children)
  child.on("exit", (code) => {
    stop();
    process.exitCode = code ?? 0;
  });
