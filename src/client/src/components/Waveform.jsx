import { useEffect, useRef } from "react";

import "./Waveform.css";

function Waveform({ audioSource }) {
  const waveformRef = useRef(null);
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const audioAnalyserRef = useRef(null);
  const prevDataArrayRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    if (!audioSource) return;

    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();

      sourceRef.current =
        audioCtxRef.current.createMediaElementSource(audioSource);

      audioAnalyserRef.current = audioCtxRef.current.createAnalyser();
      audioAnalyserRef.current.fftSize = 2048;

      const lowPassFilter = audioCtxRef.current.createBiquadFilter();
      lowPassFilter.type = "lowpass";
      lowPassFilter.frequency.value = 20000;

      sourceRef.current.connect(lowPassFilter);
      lowPassFilter.connect(audioAnalyserRef.current);
      sourceRef.current.connect(audioCtxRef.current.destination);
    }

    const handleAudioPlay = () => {
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }

      cancelAnimationFrame(animationFrameRef.current);
      drawWaveform();
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

    const amplify = (value, factor = 2.0) => {
      const norm = value * 2 - 1;

      return Math.sign(norm) * Math.pow(Math.abs(norm), factor);
    };

    const drawWaveform = () => {
      animationFrameRef.current = requestAnimationFrame(drawWaveform);

      const bufferSize = audioAnalyserRef.current.fftSize;
      const dataArray = new Uint8Array(bufferSize);

      audioAnalyserRef.current.smoothingTimeConstant = 0.3;
      audioAnalyserRef.current.getByteTimeDomainData(dataArray);

      if (!prevDataArrayRef.current) {
        prevDataArrayRef.current = new Uint8Array(bufferSize);
        prevDataArrayRef.current.set(dataArray);
      }

      const lerpedDataArray = new Uint8Array(bufferSize);
      const smoothingFactor = 0.15;

      for (let i = 0; i < bufferSize; i++) {
        lerpedDataArray[i] =
          prevDataArrayRef.current[i] * (1 - smoothingFactor) +
          dataArray[i] * smoothingFactor;
      }

      prevDataArrayRef.current.set(lerpedDataArray);

      const ctx = waveformRef.current.getContext("2d");
      const baseLine = waveformRef.current.height - 3; // wave baseline
      const amplitude = waveformRef.current.height * 0.9; // wave height

      ctx.clearRect(
        0,
        0,
        waveformRef.current.width,
        waveformRef.current.height
      );

      ctx.beginPath();

      const step = 8;
      const smoothing = 256;
      const sliceWidth = waveformRef.current.width / (bufferSize - smoothing);

      let x = 0;
      let prevX = 0;
      let prevY = baseLine;

      for (let i = 0; i <= bufferSize - smoothing; i += step) {
        let sum = 0;

        for (let j = 0; j < smoothing; j++) {
          sum += lerpedDataArray[i + j];
        }

        const v = (sum / smoothing - 128) / 128;
        const amplified = amplify(v);

        const y = baseLine - v * amplified * amplitude;

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

      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
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
