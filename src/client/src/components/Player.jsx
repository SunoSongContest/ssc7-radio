import { useEffect, useRef, useState } from "react";
import "./Player.css";

const API_URL = import.meta.env.VITE_API_URL;

function Player() {
  const [songs, setSongs] = useState([]);
  const [song, setSong] = useState(null);

  const playingIndex = useRef(0);
  const audioRef = useRef(null);

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

    const handleSongEnded = () => {
      playingIndex.current++;

      if (playingIndex.current >= songs.length) {
        playingIndex.current = 0;
      }

      console.log(playingIndex.current);

      fetchSongData(songs[playingIndex.current]);
    };

    audioRef.current.addEventListener("ended", handleSongEnded);

    if (song && song.audio_src) {
      audioRef.current.play();
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener("ended", handleSongEnded);
      }
    };
  }, [song]);

  const shuffleSongs = (songsArray) => {
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
    const songId = await getSunoSongId(song);

    const response = await fetch(
      "https://studio-api.prod.suno.com/api/clip/" + songId
    );
    const data = await response.json();

    if (data) {
      setSong({
        cover_url: data.image_large_url,
        title: data.title,
        author_name: data.display_name,
        audio_src: data.audio_url,
      });
    }
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
              <span>{song.title}</span>
            </div>
            <div className="author">
              <span>{song.author_name}</span>
            </div>
            <div className="controls">
              {song.audio_src && (
                <audio
                  ref={audioRef}
                  controls
                  autoPlay
                  controlsList="nodownload nofullscreen"
                  src={song.audio_src}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Player;
