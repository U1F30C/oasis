import Mic from 'node-microphone';
import * as fs from 'fs';
import * as path from 'path';

let mic = new Mic();
let micStream = mic.startRecording();

// Create a writable stream to save the recording to a file
const outputPath = path.join(__dirname, 'recording.wav');
const fileStream = fs.createWriteStream(outputPath);

console.log(`Recording to: ${outputPath}`);
micStream?.pipe(fileStream);
setTimeout(() => {
    console.log('stopped recording');
    mic.stopRecording();
    fileStream.end();
}, 3000);
mic.on('data', (data) => {
    console.log('data');
});
mic.on('info', (info) => {
	console.log("info");
});
mic.on('error', (error) => {
	console.log("error");
});