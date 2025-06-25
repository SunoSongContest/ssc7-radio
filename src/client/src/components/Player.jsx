import { useEffect, useRef, useState } from "react";
import "./Player.css";
import Waveform from "./Waveform";

const API_URL = import.meta.env.VITE_API_URL;

function Player() {
  const [songs, setSongs] = useState([]);
  const [song, setSong] = useState(null);

  const [isFetching, setIsFetching] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [totalDuration, setTotalDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const [isFromMobile, setIsFromMobile] = useState(false);

  const playingIndex = useRef(0);
  const audioRef = useRef(null);
  const trackWidth = useRef(0);

  useEffect(() => {
    const fetchSongs = async () => {
      try {
        const response = await fetch(`${API_URL}/api/data`);
        shuffleSongs(await response.json());
      } catch (err) {
        console.error("Unexpected error while fetching data", err);
      }
    };

    const handleWindowResize = () => {
      setIsFromMobile(window.innerWidth <= 480);
    };

    window.addEventListener("resize", handleWindowResize);

    if (songs.length === 0) {
      fetchSongs();
      handleWindowResize();
    }

    return () => window.removeEventListener("resize", handleWindowResize);
  }, []);

  useEffect(() => {
    if (songs && songs.length > 0) {
      fetchSongData(songs[0]);
    }
  }, [songs]);

  useEffect(() => {
    if (!audioRef.current) return;

    const handleSongDurationChanged = (_) => {
      trackWidth.current = 0;
      setTotalDuration(audioRef.current.duration);
    };

    const handleSongTimeUpdated = (e) => {
      trackWidth.current =
        (audioRef.current.currentTime * 100) / audioRef.current.duration;

      if (trackWidth.current < 5) {
        trackWidth.current = 5;
      }

      setCurrentTime(audioRef.current.currentTime);
    };

    const handleSongEnded = () => {
      playingIndex.current++;

      if (playingIndex.current >= songs.length) {
        playingIndex.current = 0;
      }

      fetchSongData(songs[playingIndex.current]);
    };

    audioRef.current.addEventListener(
      "durationchange",
      handleSongDurationChanged
    );
    audioRef.current.addEventListener("timeupdate", handleSongTimeUpdated);
    audioRef.current.addEventListener("ended", handleSongEnded);

    setIsFetching(false);

    if (song && song.audio_src) {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => setIsPlaying(false));
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener(
          "durationchange",
          handleSongDurationChanged
        );
        audioRef.current.removeEventListener(
          "timeupdate",
          handleSongTimeUpdated
        );
        audioRef.current.removeEventListener("ended", handleSongEnded);
      }
    };
  }, [song]);

  const shuffleSongs = (songsArray) => {
    songsArray.push({
      song_url: "https://suno.com/song/919c653c-3b2a-4d37-a845-214d659f75bd",
      song_country: "Contest Anthem",
    });
    songsArray.push({
      song_url: "https://suno.com/song/2e01a4b8-2964-47e9-86e4-a6a02af7dfef",
      song_country: "Contest Anthem",
    });

    for (let i = songsArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [songsArray[i], songsArray[j]] = [songsArray[j], songsArray[i]];
    }

    setSongs(songsArray);
  };

  const getSunoSongId = async (song) => {
    if (song.song_url.includes("https://suno.com/s/")) {
      const response = await fetch(
        "https://corsproxy.io/?url=" + encodeURI(song.song_url)
      );
      const html = await response.text();

      const match = html.match(/\/song\/([a-f0-9-]{36})/);

      if (match) {
        return match[1];
      }
    }

    const songUrlParts = song.song_url.split("/");
    return songUrlParts[songUrlParts.length - 1];
  };

  const fetchSongData = async (song) => {
    setIsFetching(true);

    const songId = await getSunoSongId(song);

    const response = await fetch(
      "https://studio-api.prod.suno.com/api/clip/" + songId
    );
    const data = await response.json();

    if (data) {
      const audioBlobResponse = await fetch(data.audio_url, { mode: "cors" });
      const audioBlob = await audioBlobResponse.blob();
      const audioBlobUrl = URL.createObjectURL(audioBlob);

      console.log(data.audio_url);
      console.log(audioBlobResponse);
      console.log(audioBlobUrl);

      setSong({
        song_url: song.song_url,
        cover_url: data.image_large_url,
        title: data.title.replace(/\s*\[[^\]]*\]/g, ""),
        author_name: data.display_name,
        country_name: song.song_country,
        audio_src: audioBlobUrl,
        profile_url: `https://suno.com/@${data.handle}`,
      });
    }
  };

  const onPlayPauseSong = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => setIsPlaying(false));
    }

    setIsPlaying(!isPlaying);
  };

  const onMuteToggle = () => {
    if (!audioRef.current) return;

    audioRef.current.volume = isMuted ? 1 : 0;

    setIsMuted(!isMuted);
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="player">
      {song && (
        <div className="content">
          <Waveform audioSource={audioRef.current} />
          <div
            className="artwork"
            style={{
              "--cover": `url('${song.cover_url}')`,
            }}
          ></div>
          <div className="info">
            <div className="title">
              <a href={song.song_url} target="_blank">
                <span>{song.title}</span>
              </a>
            </div>
            {song.country_name !== "Contest Anthem" && (
              <div className="author">
                <a href={song.profile_url} target="_blank">
                  <span>{song.author_name}</span>
                </a>
              </div>
            )}
            <div className="country">
              <span>{song.country_name}</span>
            </div>
            <div className="controls">
              <div className="progress">
                <div className="slider">
                  <span className="current">{formatTime(currentTime)}</span>
                  <div className="bar">
                    <div
                      className="track"
                      style={{ "--width": `${trackWidth.current}%` }}
                    />
                  </div>
                  <span className="total">{formatTime(totalDuration)}</span>
                </div>
                <div className="button volume" onClick={onMuteToggle}>
                  {isMuted ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="icon icon-tabler icons-tabler-outline icon-tabler-volume-off"
                    >
                      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                      <path d="M15 8a5 5 0 0 1 1.912 4.934m-1.377 2.602a5 5 0 0 1 -.535 .464" />
                      <path d="M17.7 5a9 9 0 0 1 2.362 11.086m-1.676 2.299a9 9 0 0 1 -.686 .615" />
                      <path d="M9.069 5.054l.431 -.554a.8 .8 0 0 1 1.5 .5v2m0 4v8a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l1.294 -1.664" />
                      <path d="M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="icon icon-tabler icons-tabler-outline icon-tabler-volume"
                    >
                      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                      <path d="M15 8a5 5 0 0 1 0 8" />
                      <path d="M17.7 5a9 9 0 0 1 0 14" />
                      <path d="M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5" />
                    </svg>
                  )}
                </div>
              </div>
              <div className="deck">
                {!isFromMobile && (
                  <div
                    className={`button change ${isFetching ? "disabled" : ""}`}
                    onClick={() => {
                      let t = audioRef.current.currentTime;

                      t -= 30;

                      if (t < 0) {
                        t = 0;
                      }

                      audioRef.current.currentTime = t;
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="icon icon-tabler icons-tabler-outline icon-tabler-rewind-backward-30"
                    >
                      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                      <path d="M19.007 16.466a6 6 0 0 0 -4.007 -10.466h-11" />
                      <path d="M12 15.5v3a1.5 1.5 0 0 0 3 0v-3a1.5 1.5 0 0 0 -3 0z" />
                      <path d="M6 14h1.5a1.5 1.5 0 0 1 0 3h-.5h.5a1.5 1.5 0 0 1 0 3h-1.5" />
                      <path d="M7 9l-3 -3l3 -3" />
                    </svg>
                  </div>
                )}
                <div
                  className={`button change ${isFetching ? "disabled" : ""}`}
                  onClick={() => {
                    playingIndex.current--;

                    if (playingIndex.current <= 0) {
                      playingIndex.current = 0;
                    }

                    fetchSongData(songs[playingIndex.current]);
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="icon icon-tabler icons-tabler-filled icon-tabler-player-skip-back"
                  >
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M19.496 4.136l-12 7a1 1 0 0 0 0 1.728l12 7a1 1 0 0 0 1.504 -.864v-14a1 1 0 0 0 -1.504 -.864z" />
                    <path d="M4 4a1 1 0 0 1 .993 .883l.007 .117v14a1 1 0 0 1 -1.993 .117l-.007 -.117v-14a1 1 0 0 1 1 -1z" />
                  </svg>
                </div>
                <div
                  className={`button play ${isFetching ? "disabled" : ""}`}
                  onClick={onPlayPauseSong}
                >
                  {isPlaying ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="48"
                      height="48"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="icon icon-tabler icons-tabler-filled icon-tabler-player-pause"
                    >
                      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                      <path d="M9 4h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h2a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2z" />
                      <path d="M17 4h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h2a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2z" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="48"
                      height="48"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="icon icon-tabler icons-tabler-filled icon-tabler-player-play"
                    >
                      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                      <path d="M6 4v16a1 1 0 0 0 1.524 .852l13 -8a1 1 0 0 0 0 -1.704l-13 -8a1 1 0 0 0 -1.524 .852z" />
                    </svg>
                  )}
                </div>
                <div
                  className={`button change ${isFetching ? "disabled" : ""}`}
                  onClick={() => {
                    playingIndex.current++;

                    if (playingIndex.current >= songs.length) {
                      playingIndex.current = 0;
                    }

                    fetchSongData(songs[playingIndex.current]);
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="icon icon-tabler icons-tabler-filled icon-tabler-player-skip-forward"
                  >
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M3 5v14a1 1 0 0 0 1.504 .864l12 -7a1 1 0 0 0 0 -1.728l-12 -7a1 1 0 0 0 -1.504 .864z" />
                    <path d="M20 4a1 1 0 0 1 .993 .883l.007 .117v14a1 1 0 0 1 -1.993 .117l-.007 -.117v-14a1 1 0 0 1 1 -1z" />
                  </svg>
                </div>
                {!isFromMobile && (
                  <div
                    className={`button change ${isFetching ? "disabled" : ""}`}
                    onClick={() => {
                      let t = audioRef.current.currentTime;

                      t += 30;

                      if (t > audioRef.current.duration) {
                        t = audioRef.current.duration;
                      }

                      audioRef.current.currentTime = t;
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="icon icon-tabler icons-tabler-outline icon-tabler-rewind-forward-30"
                    >
                      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                      <path d="M5.007 16.478a6 6 0 0 1 3.993 -10.478h11" />
                      <path d="M15 15.5v3a1.5 1.5 0 0 0 3 0v-3a1.5 1.5 0 0 0 -3 0z" />
                      <path d="M17 9l3 -3l-3 -3" />
                      <path d="M9 14h1.5a1.5 1.5 0 0 1 0 3h-.5h.5a1.5 1.5 0 0 1 0 3h-1.5" />
                    </svg>
                  </div>
                )}
                {song.audio_src && (
                  <audio
                    hidden
                    ref={audioRef}
                    controls
                    autoPlay
                    controlsList="nodownload nofullscreen noplaybackrate"
                    src={song.audio_src}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Player;
