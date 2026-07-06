const { spawn } = require('child_process');

console.log("Starting zeus dev automation...");
const zeus = spawn('zeus', ['dev'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, FORCE_COLOR: '1' }
});

let outputBuffer = "";
let selected = false;

zeus.stdout.on('data', (data) => {
  const str = data.toString();
  outputBuffer += str;
  process.stdout.write(str);
  
  if (!selected && str.includes("Which target would you like to preview?")) {
    console.log("\n[BOT] Detected target menu, sending down arrow and Enter to select balance2...");
    zeus.stdin.write("\u001b[B\n");
    selected = true;
  }
});

zeus.stderr.on('data', (data) => {
  process.stderr.write(data.toString());
});

zeus.on('close', (code) => {
  console.log(`[BOT] zeus dev exited with code ${code}`);
});
