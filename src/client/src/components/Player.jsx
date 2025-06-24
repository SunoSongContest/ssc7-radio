import { useEffect, useRef, useState } from "react";
import {
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconPlayerSkipBackFilled,
  IconPlayerSkipForwardFilled,
  IconRewindBackward30,
  IconRewindForward30,
  IconVolume,
  IconVolumeOff,
} from "@tabler/icons-react";
import "./Player.css";

const API_URL = import.meta.env.VITE_API_URL;

function Player() {
  const [songs, setSongs] = useState([]);
  const [song, setSong] = useState(null);

  const [isFetching, setIsFetching] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [totalDuration, setTotalDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

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

    if (songs.length === 0) {
      fetchSongs();
    }
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
      setSong({
        song_url: song.song_url,
        cover_url: data.image_large_url,
        title: data.title.replace(/\s*\[[^\]]*\]/g, ""),
        author_name: data.display_name,
        country_name: song.song_country,
        audio_src: data.audio_url,
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
                    <IconVolumeOff size={24} />
                  ) : (
                    <IconVolume size={24} />
                  )}
                </div>
              </div>
              <div className="deck">
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
                  <IconRewindBackward30 size={24} />
                </div>
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
                  <IconPlayerSkipBackFilled size={24} />
                </div>
                <div
                  className={`button play ${isFetching ? "disabled" : ""}`}
                  onClick={onPlayPauseSong}
                >
                  {isPlaying ? (
                    <IconPlayerPauseFilled size={48} />
                  ) : (
                    <IconPlayerPlayFilled size={48} />
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
                  <IconPlayerSkipForwardFilled size={24} />
                </div>
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
                  <IconRewindForward30 size={24} />
                </div>
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
