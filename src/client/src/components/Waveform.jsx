import { useEffect, useRef } from "react";

import "./Waveform.css";

function Waveform({ audioSource }) {
  const waveformRef = useRef(null);
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const audioAnalysersRef = useRef(null);
  const prevDataArrayRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastAnimationTimeRef = useRef(0);

  const fps = 30;
  const interval = 1000 / fps;

  useEffect(() => {
    if (!audioSource) return;

    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();

      sourceRef.current =
        audioCtxRef.current.createMediaElementSource(audioSource);

      const splitter = audioCtxRef.current.createChannelSplitter(2);

      const analyserLeft = audioCtxRef.current.createAnalyser();
      analyserLeft.fftSize = 2048;

      const analyserRight = audioCtxRef.current.createAnalyser();
      analyserRight.fftSize = 2048;

      splitter.connect(analyserLeft, 0);
      splitter.connect(analyserRight, 1);

      // VOCAL CHANNEL: Filtro ottimizzato per range vocali
      const vocalAnalyser = audioCtxRef.current.createAnalyser();
      vocalAnalyser.fftSize = 2048;

      // Filtro passa-alto per rimuovere basso e sub-bass
      const highpass = audioCtxRef.current.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = 250; // Taglia più in alto
      highpass.Q.value = 0.8; // Q più alto = taglio più netto

      // Filtro passa-basso per rimuovere cymbals e hi-hat
      const lowpass = audioCtxRef.current.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = 3000; // Finestra più stretta
      lowpass.Q.value = 0.8;

      // Leggero boost sulle frequenze vocali principali
      const midBoost = audioCtxRef.current.createBiquadFilter();
      midBoost.type = "peaking";
      midBoost.frequency.value = 800; // Centrato sulle formanti principali
      midBoost.Q.value = 1.5; // Q più alto = boost più focalizzato
      midBoost.gain.value = 4;

      // Gain finale
      const vocalGain = audioCtxRef.current.createGain();
      vocalGain.gain.value = 3.0; // Un po' meno amplificazione

      // Catena di filtri
      sourceRef.current.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(midBoost);
      midBoost.connect(vocalGain);
      vocalGain.connect(vocalAnalyser);

      audioAnalysersRef.current = [analyserLeft, analyserRight, vocalAnalyser];

      const lowPassFilter = audioCtxRef.current.createBiquadFilter();
      lowPassFilter.type = "lowpass";
      lowPassFilter.frequency.value = 20000;

      sourceRef.current.connect(splitter);

      sourceRef.current.connect(audioCtxRef.current.destination);
    }

    const handleAudioPlay = () => {
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }

      cancelAnimationFrame(animationFrameRef.current);
      draw();
    };

    const handleAudioPause = () => {
      cancelAnimationFrame(animationFrameRef.current);

      const ctx = waveformRef.current.getContext("2d");

      ctx.clearRect(
        0,
        0,
        waveformRef.current.width,
        waveformRef.current.height
      );
    };

    const amplify = (value, factor = 2.0) =>
      Math.sign(value) * Math.pow(Math.abs(value), factor);

    const easeInOutCubic = (t) => {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };

    const smoothInterpolate = (current, target, factor, deltaTime) => {
      // Usa un fattore dinamico basato sul tempo per consistenza
      const adaptiveFactor = Math.min(factor * (deltaTime / 16.67), 1); // 16.67ms = 60fps
      return current + (target - current) * adaptiveFactor;
    };

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);

      const time = performance.now();
      const deltaTime = time - lastAnimationTimeRef.current;

      if (deltaTime < interval) return;

      lastAnimationTimeRef.current = time;

      const ctx = waveformRef.current.getContext("2d");

      ctx.clearRect(
        0,
        0,
        waveformRef.current.width,
        waveformRef.current.height
      );

      if (!audioAnalysersRef.current) return;
      if (audioAnalysersRef.current.length === 0) return;

      const drawQueue = [];

      for (
        let analyserIndex = 0;
        analyserIndex < audioAnalysersRef.current.length;
        analyserIndex++
      ) {
        const analyser = audioAnalysersRef.current[analyserIndex];

        const bufferSize = analyser.fftSize;
        const dataArray = new Uint8Array(bufferSize);

        analyser.smoothingTimeConstant = 0.3;
        analyser.getByteTimeDomainData(dataArray);

        if (!prevDataArrayRef.current) {
          prevDataArrayRef.current = [];
        }

        if (!prevDataArrayRef.current[analyserIndex]) {
          prevDataArrayRef.current[analyserIndex] = new Uint8Array(bufferSize);
          prevDataArrayRef.current[analyserIndex].set(dataArray);
        }

        const lerpedDataArray = new Uint8Array(bufferSize);
        const smoothingFactor = 0.15;

        for (let i = 0; i < bufferSize; i++) {
          lerpedDataArray[i] =
            prevDataArrayRef.current[analyserIndex][i] * (1 - smoothingFactor) +
            dataArray[i] * smoothingFactor;
        }

        prevDataArrayRef.current[analyserIndex].set(lerpedDataArray);

        const rgbColor = () => {
          if (analyserIndex === 0) return "236, 154, 57";
          else if (analyserIndex === 1) return "90, 197, 219";
          else return "208, 63, 113";
        };

        const color = rgbColor();

        drawQueue.push({
          bufferSize,
          lerpedDataArray,
          analyserIndex,
          rgbColor: color,
        });
      }

      for (let i = 0; i < drawQueue.length; i++) {
        const q = drawQueue[i];

        drawWaveform(
          ctx,
          q.bufferSize,
          q.lerpedDataArray,
          q.analyserIndex,
          q.rgbColor
        );
      }
    };

    const drawWaveform = (
      ctx,
      bufferSize,
      lerpedDataArray,
      analyserIndex,
      rgbColor
    ) => {
      const baseLine = waveformRef.current.height - 3; // wave baseline
      const amplitudeM = analyserIndex === 2 ? 3 : 1;
      const amplitude = waveformRef.current.height * 1.2 * amplitudeM; // wave height

      const step = 16;
      const smoothing = 256;
      const sliceWidth = waveformRef.current.width / (bufferSize - smoothing);

      let x = 0;
      let prevX = 0;
      let prevY = baseLine;

      const min = Math.min(...lerpedDataArray);
      const max = Math.max(...lerpedDataArray);
      const avg =
        lerpedDataArray.reduce((sum, val) => sum + val, 0) /
        lerpedDataArray.length;
      const range = Math.max(1, max - min);

      ctx.beginPath();

      for (let i = 0; i <= bufferSize - smoothing; i += step) {
        let sum = 0;

        for (let j = 0; j < smoothing; j++) {
          sum += lerpedDataArray[i + j];
        }

        const v = ((sum / smoothing - min) / range) * 2 - 1;
        const amplified = amplify(v);

        const y = baseLine - amplified * amplitude;

        if (i === 0) ctx.moveTo(0, baseLine);
        else {
          const midX = (prevX + x) / 2;
          const midY = (prevY + y) / 2;

          ctx.quadraticCurveTo(prevX, prevY, midX, midY);
        }

        prevX = x;
        prevY = y;

        x += sliceWidth * step;

        if (x > waveformRef.current.width) break;
      }

      ctx.lineTo(waveformRef.current.width, baseLine + 3);
      ctx.lineTo(0, baseLine + 12);
      ctx.closePath();

      const volume =
        analyserIndex === 2
          ? lerpedDataArray.reduce(
              (sum, val) => sum + Math.pow(Math.abs(val - 128), 1.5),
              0
            ) / lerpedDataArray.length
          : lerpedDataArray.reduce((sum, val) => sum + Math.abs(val - 128), 0) /
            lerpedDataArray.length;

      const volumeDivisor = analyserIndex === 2 ? 3 : 15;

      const alphaBlur = Math.min(1, volume / volumeDivisor);

      if (
        import.meta.env.VITE_WAVEFORM_LOG_ENABLED === "true" &&
        Math.random() < 0.03
      ) {
        const channelName =
          analyserIndex === 0
            ? "LEFT"
            : analyserIndex === 1
            ? "RIGHT"
            : "VOCAL";

        console.log(`=== ${channelName} CHANNEL ===`);
        console.log(`Min: ${min}, Max: ${max}, Avg: ${avg.toFixed(1)}`);
        console.log(`Range: ${range}, Volume: ${volume.toFixed(2)}`);

        // Controlla se ci sono dati "piatti" (segnale morto)
        if (range < 5) {
          console.log(`⚠️  ${channelName}: SEGNALE TROPPO PIATTO!`);
        }

        // Controlla se siamo vicini al baseline (128)
        if (Math.abs(avg - 128) < 2) {
          console.log(`ℹ️  ${channelName}: Segnale centrato su 128 (normale)`);
        }

        // Campiona alcuni valori raw
        const samples = [
          lerpedDataArray[0],
          lerpedDataArray[Math.floor(bufferSize / 4)],
          lerpedDataArray[Math.floor(bufferSize / 2)],
          lerpedDataArray[Math.floor((bufferSize * 3) / 4)],
          lerpedDataArray[bufferSize - 1],
        ];
        console.log(`Samples: [${samples.join(", ")}]`);
        console.log("---");
      }

      ctx.fillStyle = `rgb(${rgbColor})`;
      ctx.shadowColor = `rgba(${rgbColor}, 0.8)`;
      ctx.shadowBlur = 20 * alphaBlur;

      ctx.fill();
    };

    if (!audioSource.paused) {
      handleAudioPlay();
    }

    audioSource.addEventListener("play", handleAudioPlay);
    audioSource.addEventListener("pause", handleAudioPause);

    return () => {
      audioSource.removeEventListener("play", handleAudioPlay);
      audioSource.removeEventListener("pause", handleAudioPause);

      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [audioSource]);

  return <canvas ref={waveformRef} className="waveform" />;
}

export default Waveform;
