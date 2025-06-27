import { useState, useRef, useEffect } from "react";

export default function VocalCalibrationTool() {
  const [audioFile, setAudioFile] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Filter parameters
  const [params, setParams] = useState({
    highpassFreq: 250,
    highpassQ: 0.8,
    lowpassFreq: 3000,
    lowpassQ: 0.8,
    peakingFreq: 800,
    peakingQ: 1.5,
    peakingGain: 4,
    vocalGain: 3.0,
  });

  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const analyzersRef = useRef([]);
  const animationRef = useRef(null);
  const filtersRef = useRef({});

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith("audio/")) {
      const url = URL.createObjectURL(file);
      setAudioFile(url);

      if (audioRef.current) {
        audioRef.current.src = url;
      }
    }
  };

  const setupAudioContext = () => {
    if (!audioCtxRef.current && audioRef.current) {
      audioCtxRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();

      sourceRef.current = audioCtxRef.current.createMediaElementSource(
        audioRef.current
      );

      // Left/Right analyzers
      const splitter = audioCtxRef.current.createChannelSplitter(2);
      const analyzerLeft = audioCtxRef.current.createAnalyser();
      const analyzerRight = audioCtxRef.current.createAnalyser();

      analyzerLeft.fftSize = 2048;
      analyzerRight.fftSize = 2048;

      sourceRef.current.connect(splitter);
      splitter.connect(analyzerLeft, 0);
      splitter.connect(analyzerRight, 1);

      // Vocal analyzer with filters
      const analyzerVocal = audioCtxRef.current.createAnalyser();
      analyzerVocal.fftSize = 2048;

      // Create filters
      const highpass = audioCtxRef.current.createBiquadFilter();
      const lowpass = audioCtxRef.current.createBiquadFilter();
      const peaking = audioCtxRef.current.createBiquadFilter();
      const vocalGain = audioCtxRef.current.createGain();

      highpass.type = "highpass";
      lowpass.type = "lowpass";
      peaking.type = "peaking";

      // Store filter references
      filtersRef.current = { highpass, lowpass, peaking, vocalGain };

      // Connect vocal chain
      sourceRef.current.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(peaking);
      peaking.connect(vocalGain);
      vocalGain.connect(analyzerVocal);

      analyzersRef.current = [analyzerLeft, analyzerRight, analyzerVocal];

      // Connect to destination
      sourceRef.current.connect(audioCtxRef.current.destination);

      updateFilters();
    }
  };

  const updateFilters = () => {
    if (filtersRef.current.highpass) {
      const { highpass, lowpass, peaking, vocalGain } = filtersRef.current;

      highpass.frequency.value = params.highpassFreq;
      highpass.Q.value = params.highpassQ;

      lowpass.frequency.value = params.lowpassFreq;
      lowpass.Q.value = params.lowpassQ;

      peaking.frequency.value = params.peakingFreq;
      peaking.Q.value = params.peakingQ;
      peaking.gain.value = params.peakingGain;

      vocalGain.gain.value = params.vocalGain;
    }
  };

  useEffect(() => {
    updateFilters();
  }, [params]);

  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (audioCtxRef.current?.state === "suspended") {
      audioCtxRef.current.resume();
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      cancelAnimationFrame(animationRef.current);
    } else {
      setupAudioContext();
      audioRef.current.play();
      setIsPlaying(true);
      draw();
    }
  };

  const draw = () => {
    if (!canvasRef.current || !analyzersRef.current.length) return;

    animationRef.current = requestAnimationFrame(draw);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const colors = ["#ec9a39", "#5ac5db", "#d03f71"];
    const labels = ["Left", "Right", "Vocal"];

    analyzersRef.current.forEach((analyzer, index) => {
      const bufferLength = analyzer.fftSize;
      const dataArray = new Uint8Array(bufferLength);
      analyzer.getByteTimeDomainData(dataArray);

      const y = (canvas.height / 3) * index;
      const height = canvas.height / 3;

      ctx.strokeStyle = colors[index];
      ctx.lineWidth = 2;
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const yPos = y + (v * height) / 2 + height / 2;

        if (i === 0) {
          ctx.moveTo(x, yPos);
        } else {
          ctx.lineTo(x, yPos);
        }

        x += sliceWidth;
      }

      ctx.stroke();

      // Label
      ctx.fillStyle = colors[index];
      ctx.font = "14px monospace";
      ctx.fillText(labels[index], 10, y + 20);

      // Volume indicator
      const volume =
        dataArray.reduce((sum, val) => sum + Math.abs(val - 128), 0) /
        dataArray.length;
      ctx.fillText(`Vol: ${volume.toFixed(1)}`, 10, y + 40);
    });
  };

  const updateParam = (key, value) => {
    setParams((prev) => ({ ...prev, [key]: parseFloat(value) }));
  };

  const exportParams = () => {
    const code = `
// Optimized parameters for your audio:
highpass.frequency.value = ${params.highpassFreq};
highpass.Q.value = ${params.highpassQ};

lowpass.frequency.value = ${params.lowpassFreq};
lowpass.Q.value = ${params.lowpassQ};

peaking.frequency.value = ${params.peakingFreq};
peaking.Q.value = ${params.peakingQ};
peaking.gain.value = ${params.peakingGain};

vocalGain.gain.value = ${params.vocalGain};`;

    navigator.clipboard.writeText(code);
    alert("Parameters copied to clipboard!");
  };

  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Vocal Filter Calibration Tool</h1>

      <div className="mb-6">
        <input
          type="file"
          accept="audio/*"
          onChange={handleFileUpload}
          className="mb-4 p-2 bg-gray-800 rounded"
        />

        {audioFile && (
          <audio
            ref={audioRef}
            src={audioFile}
            onLoadedMetadata={() =>
              setDuration(audioRef.current?.duration || 0)
            }
            onTimeUpdate={() =>
              setCurrentTime(audioRef.current?.currentTime || 0)
            }
            className="hidden"
          />
        )}

        {audioFile && (
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={togglePlayPause}
              className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
            >
              {isPlaying ? "Pause" : "Play"}
            </button>

            <div className="flex-1">
              <input
                type="range"
                min="0"
                max={duration}
                value={currentTime}
                onChange={(e) => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = e.target.value;
                  }
                }}
                className="w-full"
              />
              <div className="text-sm text-gray-400">
                {Math.floor(currentTime)}s / {Math.floor(duration)}s
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Filter Parameters</h2>

          <div className="space-y-4">
            <div className="bg-gray-800 p-4 rounded">
              <h3 className="font-semibold mb-2">High Pass Filter</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1">
                    Frequency: {params.highpassFreq}Hz
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="500"
                    value={params.highpassFreq}
                    onChange={(e) =>
                      updateParam("highpassFreq", e.target.value)
                    }
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">
                    Q: {params.highpassQ}
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="5"
                    step="0.1"
                    value={params.highpassQ}
                    onChange={(e) => updateParam("highpassQ", e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-800 p-4 rounded">
              <h3 className="font-semibold mb-2">Low Pass Filter</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1">
                    Frequency: {params.lowpassFreq}Hz
                  </label>
                  <input
                    type="range"
                    min="1000"
                    max="8000"
                    value={params.lowpassFreq}
                    onChange={(e) => updateParam("lowpassFreq", e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">
                    Q: {params.lowpassQ}
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="5"
                    step="0.1"
                    value={params.lowpassQ}
                    onChange={(e) => updateParam("lowpassQ", e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-800 p-4 rounded">
              <h3 className="font-semibold mb-2">
                Peaking Filter (Vocal Boost)
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm mb-1">
                    Freq: {params.peakingFreq}Hz
                  </label>
                  <input
                    type="range"
                    min="200"
                    max="2000"
                    value={params.peakingFreq}
                    onChange={(e) => updateParam("peakingFreq", e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">
                    Q: {params.peakingQ}
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="5"
                    step="0.1"
                    value={params.peakingQ}
                    onChange={(e) => updateParam("peakingQ", e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">
                    Gain: {params.peakingGain}dB
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={params.peakingGain}
                    onChange={(e) => updateParam("peakingGain", e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-800 p-4 rounded">
              <h3 className="font-semibold mb-2">Output Gain</h3>
              <div>
                <label className="block text-sm mb-1">
                  Vocal Gain: {params.vocalGain}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="10"
                  step="0.1"
                  value={params.vocalGain}
                  onChange={(e) => updateParam("vocalGain", e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <button
            onClick={exportParams}
            className="mt-4 px-6 py-2 bg-green-600 rounded hover:bg-green-700 w-full"
          >
            Copy Optimized Parameters
          </button>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Live Waveforms</h2>
          <canvas
            ref={canvasRef}
            width={600}
            height={400}
            className="w-full bg-black rounded"
          />
          <div className="mt-2 text-sm text-gray-400">
            <div className="flex justify-between">
              <span className="text-orange-400">■ Left Channel</span>
              <span className="text-blue-400">■ Right Channel</span>
              <span className="text-pink-400">■ Vocal Channel</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
