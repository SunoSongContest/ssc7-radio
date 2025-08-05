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

      // FREQUENZE BASSE (20Hz - 400Hz) - Filtri più permissivi per Suno AI
      const bassAnalyser = audioCtxRef.current.createAnalyser();
      bassAnalyser.fftSize = 2048;

      // Filtro passa-basso molto permissivo
      const bassLowpass1 = audioCtxRef.current.createBiquadFilter();
      bassLowpass1.type = "lowpass";
      bassLowpass1.frequency.value = 400; // Molto più alto per far passare più segnale
      bassLowpass1.Q.value = 0.7; // Q basso per pendenza dolce

      // Filtro passa-alto molto permissivo
      const bassHighpass = audioCtxRef.current.createBiquadFilter();
      bassHighpass.type = "highpass";
      bassHighpass.frequency.value = 20; // Molto basso per non tagliare nulla
      bassHighpass.Q.value = 0.3; // Q molto basso

      // Boost dolce sui bassi
      const bassBoost = audioCtxRef.current.createBiquadFilter();
      bassBoost.type = "peaking";
      bassBoost.frequency.value = 100;
      bassBoost.Q.value = 0.8; // Q più basso per boost più ampio
      bassBoost.gain.value = 2; // Boost più moderato

      const bassGain = audioCtxRef.current.createGain();
      bassGain.gain.value = 2.0; // Gain più basso per evitare saturazione

      // FREQUENZE MEDIE (200Hz - 6kHz) - Molto permissive per catturare le voci
      const midAnalyser = audioCtxRef.current.createAnalyser();
      midAnalyser.fftSize = 2048;

      const midLowpass = audioCtxRef.current.createBiquadFilter();
      midLowpass.type = "lowpass";
      midLowpass.frequency.value = 6000; // Molto più alto
      midLowpass.Q.value = 0.5; // Q molto basso

      const midHighpass = audioCtxRef.current.createBiquadFilter();
      midHighpass.type = "highpass";
      midHighpass.frequency.value = 200; // Più basso per overlap con bassi
      midHighpass.Q.value = 0.5; // Q molto basso

      // Boost dolce sulle frequenze vocali
      const midBoost1 = audioCtxRef.current.createBiquadFilter();
      midBoost1.type = "peaking";
      midBoost1.frequency.value = 1000;
      midBoost1.Q.value = 0.7; // Q più basso per boost più ampio
      midBoost1.gain.value = 1.5; // Boost più dolce

      const midGain = audioCtxRef.current.createGain();
      midGain.gain.value = 1.8; // Gain più basso

      // FREQUENZE ACUTE (4kHz+) - Permissive per preservare dettagli
      const trebleAnalyser = audioCtxRef.current.createAnalyser();
      trebleAnalyser.fftSize = 2048;

      // Filtro passa-alto permissivo
      const trebleHighpass1 = audioCtxRef.current.createBiquadFilter();
      trebleHighpass1.type = "highpass";
      trebleHighpass1.frequency.value = 4000;
      trebleHighpass1.Q.value = 0.5; // Q molto basso

      // Boost dolce per gli acuti
      const trebleBoost = audioCtxRef.current.createBiquadFilter();
      trebleBoost.type = "peaking";
      trebleBoost.frequency.value = 8000;
      trebleBoost.Q.value = 0.8;
      trebleBoost.gain.value = 2; // Boost più moderato

      const trebleGain = audioCtxRef.current.createGain();
      trebleGain.gain.value = 3.0; // Gain ridotto

      // Bassi: semplificata per ridurre perdite di segnale
      sourceRef.current.connect(bassHighpass);
      bassHighpass.connect(bassLowpass1);
      bassLowpass1.connect(bassBoost);
      bassBoost.connect(bassGain);
      bassGain.connect(bassAnalyser);

      // Medi: catena minima
      sourceRef.current.connect(midHighpass);
      midHighpass.connect(midLowpass);
      midLowpass.connect(midBoost1);
      midBoost1.connect(midGain);
      midGain.connect(midAnalyser);

      // Acuti: catena semplificata
      sourceRef.current.connect(trebleHighpass1);
      trebleHighpass1.connect(trebleBoost);
      trebleBoost.connect(trebleGain);
      trebleGain.connect(trebleAnalyser);

      audioAnalysersRef.current = [bassAnalyser, midAnalyser, trebleAnalyser];

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

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);

      const time = performance.now();
      const deltaTime = time - lastAnimationTimeRef.current;

      if (deltaTime < interval) return;

      lastAnimationTimeRef.current = time;

      const playTime = audioSource.currentTime;
      const maxTime = audioSource.duration - 0.2;

      if (playTime <= 0.2 || playTime >= maxTime) return;

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
          if (analyserIndex === 0) return "208, 63, 113";
          else if (analyserIndex === 1) return "236, 154, 57";
          else return "90, 197, 219";
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
      const amplitudeM =
        analyserIndex === 0 ? 1.8 : analyserIndex === 1 ? 3.5 : 1.2;
      const amplitude = waveformRef.current.height * 0.9 * amplitudeM; // wave height

      const step = 24;
      const smoothing = 192;
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

        let y = baseLine - amplified * amplitude;
        y = Math.max(0, Math.min(waveformRef.current.height, y));

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

      const volumeDivisor =
        analyserIndex === 0 ? 4 : analyserIndex === 1 ? 6 : 12;

      const alphaBlur = Math.min(1, volume / volumeDivisor);

      if (
        import.meta.env.VITE_WAVEFORM_LOG_ENABLED === "true" &&
        Math.random() < 0.03
      ) {
        const channelName =
          analyserIndex === 0 ? "BASS" : analyserIndex === 1 ? "MID" : "TREBLE";

        console.log(`=== ${channelName} FREQUENCIES ===`);
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
