import { execSync } from "node:child_process";
import fs from "node:fs";

function sleep(ms) {
  execSync(`powershell -NoProfile -Command "Start-Sleep -Milliseconds ${ms}"`, {
    stdio: "ignore",
  });
}

function killPort3000() {
  if (process.platform === "win32") {
    try {
      execSync(
        'powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"',
        { stdio: "ignore" }
      );
      sleep(500);
    } catch {
      // port not in use
    }
    return;
  }

  try {
    execSync("lsof -ti:3000 | xargs kill -9 2>/dev/null", {
      stdio: "ignore",
      shell: true,
    });
  } catch {
    // port not in use
  }
}

function rmDir(dir) {
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 300,
  });
  console.log(`Removed ${dir}`);
}

killPort3000();
rmDir(".next");
rmDir("node_modules/.cache");

console.log("Clean complete.");
