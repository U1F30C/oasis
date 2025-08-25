const AudioRecorder = require('node-audiorecorder');
import * as fs from 'fs';
import * as path from 'path';

// Configure audio recorder options
const options = {
  program: 'rec',        // Use 'rec' program (part of SoX)
  device: null,          // Use default recording device
  bits: 16,             // 16-bit audio
  channels: 1,          // Mono recording
  encoding: 'signed-integer',
  rate: 16000,          // 16kHz sample rate
  type: 'wav',          // WAV format
  silence: 0,           // Don't stop on silence
  thresholdStart: 0.5,
  thresholdStop: 0.5,
  keepSilence: true
};

// Create audio recorder instance
const audioRecorder = new AudioRecorder(options, console);

// Function to record audio for specified duration
function recordAudio(durationSeconds: number = 4): Promise<void> {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(__dirname, 'recording.wav');
    const writeStream = fs.createWriteStream(outputPath);
    
    console.log(`Starting ${durationSeconds}-second audio recording...`);
    console.log(`Output file: ${outputPath}`);
    
    // Start recording
    audioRecorder.start();
    
    // Get the audio stream and pipe it to file
    const audioStream = audioRecorder.stream();
    audioStream.pipe(writeStream);
    
    // Handle stream events
    writeStream.on('error', (error) => {
      console.error('Write stream error:', error);
      audioRecorder.stop();
      reject(error);
    });
    
    audioStream.on('error', (error) => {
      console.error('Audio stream error:', error);
      audioRecorder.stop();
      reject(error);
    });
    
    // Stop recording after specified duration
    setTimeout(() => {
      console.log('Stopping recording...');
      audioRecorder.stop();
      
      // Close the write stream
      writeStream.end();
      
      writeStream.on('finish', () => {
        console.log(`Recording saved to: ${outputPath}`);
        resolve();
      });
    }, durationSeconds * 1000);
  });
}

// Main execution
async function main() {
  try {
    await recordAudio(4); // Record for 4 seconds
    console.log('Recording completed successfully!');
  } catch (error) {
    console.error('Recording failed:', error);
    process.exit(1);
  }
}

// Run the script if executed directly
if (require.main === module) {
  main();
}

// Export for use in other modules
export { recordAudio, audioRecorder };