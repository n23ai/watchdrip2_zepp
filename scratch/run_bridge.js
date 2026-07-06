const { spawn } = require('child_process');

console.log("Starting zeus bridge automation...");
const zeus = spawn('zeus', ['bridge'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, FORCE_COLOR: '1' }
});

let outputBuffer = "";
let state = "init"; // init -> connect_sent -> target_sent -> install_sent

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
    // Check options
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
      state = "target_sent";
      outputBuffer = "";
    }
  }
  
  if ((state === "init" || state === "connect_sent" || state === "target_sent") && 
      (clean.includes("successfully connected") || clean.includes("connected to app-Android"))) {
    console.log("\n[BOT] Connected to phone! Sending install...");
    zeus.stdin.write("install\n");
    state = "install_sent";
    outputBuffer = "";
  }
  
  if (state === "install_sent" && clean.includes("Which target would you like to preview?")) {
    const lines = clean.split('\n');
    const selectedLine = lines.find(l => l.includes("❯"));
    if (selectedLine && selectedLine.includes("common")) {
      console.log("\n[BOT] common is already selected! Sending Enter...");
      zeus.stdin.write("\n");
    } else {
      // Find index of common in the list
      const commonIdx = lines.findIndex(l => l.includes("common"));
      const selectedIdx = lines.findIndex(l => l.includes("❯"));
      if (commonIdx !== -1 && selectedIdx !== -1) {
        const diff = commonIdx - selectedIdx;
        if (diff > 0) {
          // Send down arrows
          zeus.stdin.write("\u001b[B".repeat(diff) + "\n");
        } else if (diff < 0) {
          // Send up arrows
          zeus.stdin.write("\u001b[A".repeat(-diff) + "\n");
        } else {
          zeus.stdin.write("\n");
        }
      } else {
        zeus.stdin.write("\n");
      }
    }
    state = "target_selected";
    outputBuffer = "";
  }
  
  if ((state === "install_sent" || state === "target_selected") && clean.includes("Install lite app result: success")) {
    console.log("\n[BOT] Installation successful! Streaming logs in real time. Launch the app on your watch now...");
    state = "streaming_logs";
    outputBuffer = "";
  }
});

zeus.stderr.on('data', (data) => {
  process.stderr.write(data.toString());
});

zeus.on('close', (code) => {
  console.log(`[BOT] zeus bridge exited with code ${code}`);
});

