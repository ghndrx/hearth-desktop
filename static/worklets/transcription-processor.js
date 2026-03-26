/**
 * Transcription Audio Processor WorkletProcessor
 * Processes audio streams in real-time for transcription
 */

class TranscriptionProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();

        this.sampleRate = options.processorOptions?.sampleRate || 16000;
        this.inputSampleRate = sampleRate; // Global sampleRate from AudioContext
        this.bufferSize = Math.floor(this.sampleRate * 0.1); // 100ms chunks
        this.buffer = [];
        this.downsampleRatio = this.inputSampleRate / this.sampleRate;
        this.downsampleCounter = 0;

        // For resampling
        this.lastSample = 0;

        console.log(`[TranscriptionProcessor] Initialized: ${this.inputSampleRate}Hz -> ${this.sampleRate}Hz`);
    }

    /**
     * Simple linear interpolation downsampling
     */
    downsample(inputData) {
        if (this.downsampleRatio === 1) {
            return inputData;
        }

        const outputLength = Math.floor(inputData.length / this.downsampleRatio);
        const output = new Float32Array(outputLength);

        for (let i = 0; i < outputLength; i++) {
            const inputIndex = i * this.downsampleRatio;
            const index = Math.floor(inputIndex);
            const fraction = inputIndex - index;

            if (index + 1 < inputData.length) {
                // Linear interpolation
                output[i] = inputData[index] * (1 - fraction) + inputData[index + 1] * fraction;
            } else {
                output[i] = inputData[index];
            }
        }

        return output;
    }

    /**
     * Apply a simple high-pass filter to remove DC offset and low-frequency noise
     */
    highPassFilter(data) {
        const alpha = 0.95; // Filter coefficient
        let filteredData = new Float32Array(data.length);
        filteredData[0] = data[0];

        for (let i = 1; i < data.length; i++) {
            filteredData[i] = alpha * (filteredData[i - 1] + data[i] - data[i - 1]);
        }

        return filteredData;
    }

    /**
     * Detect voice activity using a simple energy-based approach
     */
    isVoiceActive(data) {
        // Calculate RMS energy
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            sum += data[i] * data[i];
        }
        const rms = Math.sqrt(sum / data.length);

        // Simple threshold for voice activity detection
        const threshold = 0.01; // Adjust as needed
        return rms > threshold;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];

        if (input.length > 0 && input[0].length > 0) {
            const inputData = input[0]; // First channel

            // Copy input to output (passthrough)
            if (output.length > 0 && output[0].length > 0) {
                output[0].set(inputData);
            }

            // Apply high-pass filter to remove DC offset
            const filtered = this.highPassFilter(inputData);

            // Downsample to target sample rate
            const downsampled = this.downsample(filtered);

            // Check for voice activity
            if (this.isVoiceActive(downsampled)) {
                // Add to buffer
                this.buffer.push(...downsampled);

                // If buffer is full, send it for processing
                if (this.buffer.length >= this.bufferSize) {
                    const audioData = new Float32Array(this.buffer.slice(0, this.bufferSize));

                    // Send audio data to main thread
                    this.port.postMessage({
                        type: 'audioData',
                        audioData: audioData,
                        sampleRate: this.sampleRate,
                        timestamp: currentTime
                    });

                    // Keep some overlap for smoother processing
                    const overlapSize = Math.floor(this.bufferSize * 0.1);
                    this.buffer = this.buffer.slice(this.bufferSize - overlapSize);
                }
            } else {
                // No voice activity, but keep a small buffer to catch speech onset
                const maxSilenceBuffer = Math.floor(this.sampleRate * 0.05); // 50ms
                if (this.buffer.length > maxSilenceBuffer) {
                    this.buffer = this.buffer.slice(-maxSilenceBuffer);
                }
            }
        }

        return true; // Keep processor alive
    }
}

// Register the processor
registerProcessor('transcription-processor', TranscriptionProcessor);