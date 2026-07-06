const { spawn } = require('child_process');

console.log("Starting zeus bridge for screenshot...");
const zeus = spawn('zeus', ['bridge'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, FORCE_COLOR: '1' }
});

let outputBuffer = "";
let state = "init"; // init -> connect_sent -> connected -> screenshot_sent

function cleanANSI(str) {
  return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

zeus.stdout.on('data', (data) => {
  const str = data.toString();
  outputBuffer += str;
  process.stdout.write(str);
  
  const clean = cleanANSI(outputBuffer);
  
  if (state === "init" && clean.includes("Enter 'help' to view the command")) {
    console.log("\n[BOT] Sending connect...");
    zeus.stdin.write("connect\n");
    state = "connect_sent";
    outputBuffer = "";
  }
  
  if (state === "connect_sent" && clean.includes("Which online target would you like to connect?")) {
    const lines = clean.split('\n');
    const appAndroidIdx = lines.findIndex(l => l.includes("app-Android"));
    const simulatorIdx = lines.findIndex(l => l.includes("Simulator"));
    
    if (appAndroidIdx !== -1) {
      console.log("\n[BOT] Found app-Android. Selecting it...");
      if (simulatorIdx !== -1 && appAndroidIdx > simulatorIdx) {
        // app-Android is below Simulator, send down arrow
        zeus.stdin.write("\u001b[B\n");
      } else {
        zeus.stdin.write("\n");
      }
      state = "connected";
      outputBuffer = "";
    }
  }
  
  if ((state === "init" || state === "connect_sent" || state === "connected") && 
      (clean.includes("successfully connected") || clean.includes("connected to app-Android"))) {
    console.log("\n[BOT] Connected to phone! Sending screenshot...");
    zeus.stdin.write("screenshot\n");
    state = "screenshot_sent";
    outputBuffer = "";
  }
  
  if (state === "screenshot_sent" && clean.includes("bridge$")) {
    console.log("\n[BOT] Screenshot command completed. Exiting in 2s...");
    setTimeout(() => {
      zeus.kill();
      process.exit(0);
    }, 2000);
  }
});

zeus.stderr.on('data', (data) => {
  process.stderr.write(data.toString());
});

zeus.on('close', (code) => {
  console.log(`[BOT] zeus bridge exited with code ${code}`);
});
