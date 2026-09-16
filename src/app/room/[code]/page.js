"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Video, VideoOff, Mic, MicOff, PhoneOff,
  Send, MessageSquare, AlertCircle, User, Copy, Check
} from "lucide-react";
import { usePeer } from "@/hooks/usePeer";
import styles from "./page.module.css";

export default function Room() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = params?.code;
  const mode = searchParams.get("mode") || "guest";

  const [chatInput, setChatInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [myName, setMyName] = useState("");
  const messagesEndRef = useRef(null);

  // Retrieve username from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem("chatfrnd_username");
    if (stored) {
      // eslint-disable-next-line
      setMyName(stored);
    } else {
      // eslint-disable-next-line
      setMyName("You");
    }
  }, []);

  const {
    isConnected,
    localVideoRef,
    remoteVideoRef,
    messages,
    sendMessage,
    isMuted,
    toggleMute,
    isVideoOff,
    toggleVideo,
    error,
    remoteName,
  } = usePeer(code, mode, myName);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    const msg = chatInput.trim();
    if (!msg) return;
    const sent = sendMessage(msg);
    if (sent) setChatInput("");
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeave = () => {
    router.push("/");
  };

  const myInitial = myName ? myName[0].toUpperCase() : "Y";
  const remoteInitial = remoteName ? remoteName[0].toUpperCase() : "F";
  const displayRemoteName = remoteName || "Friend";

  return (
    <div className={styles.room}>

      {/* ── Left: Main video + controls ── */}
      <div className={styles.main}>

        {/* Header */}
        <div className={`${styles.header} glass`}>
          <div className={styles.brandRow}>
            <div className={styles.brandIcon}>
              <Video size={18} color="white" />
            </div>
            <span className={styles.brandName}>ChatFrnd</span>
          </div>

          <div className={styles.codeChip}>
            <span className={styles.codeLabel}>Room</span>
            <span className={styles.codeValue}>{code}</span>
            <button onClick={handleCopyCode} title="Copy code" style={{ color: "var(--primary-light)", display: "flex" }}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className={`${styles.statusDot} ${isConnected ? styles.connected : ""}`} />
            <span style={{ fontSize: "0.82rem", color: "var(--text-subtle)" }}>
              {isConnected ? `Connected with ${displayRemoteName}` : mode === "host" ? "Waiting for friend…" : "Connecting…"}
            </span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className={styles.errorBanner}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Videos */}
        <div className={styles.videos}>
          {/* Local */}
          <div className={styles.videoBox}>
            <video ref={localVideoRef} autoPlay muted playsInline />
            <div className={styles.videoLabel}>
              <div className={styles.videoAvatar}>{myInitial}</div>
              {myName || "You"}
            </div>
          </div>

          {/* Remote */}
          <div className={styles.videoBox}>
            <video ref={remoteVideoRef} autoPlay playsInline />
            {!isConnected && (
              <div className={styles.videoPlaceholder}>
                <div className={styles.avatarCircle}>
                  <User size={32} color="var(--text-muted)" />
                </div>
                <span>
                  {mode === "host" ? "Waiting for friend to join…" : "Connecting to host…"}
                </span>
              </div>
            )}
            {isConnected && (
              <div className={styles.videoLabel}>
                <div className={`${styles.videoAvatar} ${styles.remoteAvatar}`}>{remoteInitial}</div>
                {displayRemoteName}
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className={`${styles.controls} glass`}>
          <button
            id="toggle-mute"
            className={`btn-icon ${isMuted ? "muted" : ""}`}
            onClick={toggleMute}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>

          <button
            id="toggle-video"
            className={`btn-icon ${isVideoOff ? "video-off" : ""}`}
            onClick={toggleVideo}
            title={isVideoOff ? "Start camera" : "Stop camera"}
          >
            {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
          </button>

          <button id="leave-room" className="btn-danger" onClick={handleLeave}>
            <PhoneOff size={18} /> Leave
          </button>
        </div>
      </div>

      {/* ── Right: Chat sidebar ── */}
      <div className={`${styles.sidebar} glass`}>
        <div className={styles.chatHeader}>
          <MessageSquare size={18} color="var(--primary-light)" />
          <span className={styles.chatTitle}>Chat</span>
          <span className={`${styles.connBadge} ${isConnected ? styles.live : ""}`}>
            {isConnected ? "● Live" : "● Offline"}
          </span>
        </div>

        <div className={styles.messages}>
          {messages.length === 0 ? (
            <div className={styles.emptyState}>
              <MessageSquare size={28} color="var(--text-muted)" />
              <span>{isConnected ? "No messages yet — say hi! 👋" : "Messages will appear once connected."}</span>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`${styles.bubbleWrap} ${styles[m.sender]}`}>
                <span className={styles.bubbleName}>
                  {m.sender === "self" ? myName || "You" : m.senderName || displayRemoteName}
                </span>
                <div className={`${styles.bubble} ${styles[m.sender]}`}>
                  {m.text}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} className={styles.chatInput}>
          <input
            id="chat-input"
            type="text"
            className="input-field"
            placeholder={isConnected ? "Type a message…" : "Waiting for friend…"}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            disabled={!isConnected}
          />
          <button
            id="send-btn"
            type="submit"
            className={`btn-primary ${styles.sendBtn}`}
            disabled={!isConnected || !chatInput.trim()}
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
