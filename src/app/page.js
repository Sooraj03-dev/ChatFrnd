"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Video, Shield, Zap, ArrowRight, Lock, User } from "lucide-react";
import styles from "./page.module.css";

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");

  const validateName = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter your name to continue.");
      return false;
    }
    if (trimmed.length > 20) {
      setError("Name must be 20 characters or less.");
      return false;
    }
    return true;
  };

  const handleCreateRoom = () => {
    if (!validateName()) return;
    sessionStorage.setItem("chatfrnd_username", name.trim());
    const code = generateCode();
    router.push(`/room/${code}?mode=host`);
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!validateName()) return;
    const trimmed = joinCode.trim();
    if (trimmed.length === 6 && /^\d+$/.test(trimmed)) {
      sessionStorage.setItem("chatfrnd_username", name.trim());
      router.push(`/room/${trimmed}?mode=guest`);
    } else {
      setError("Please enter a valid 6-digit numeric code.");
    }
  };

  const initial = name.trim() ? name.trim()[0].toUpperCase() : "";

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <Video size={24} color="white" />
          </div>
          <span className={styles.logoText}>ChatFrnd</span>
        </div>
        <p className={styles.tagline}>
          Instant private video calls &amp; chat — no account needed. Just share a 6-digit code.
        </p>
        <div className={styles.features}>
          <span className={styles.pill}><Lock size={12} /> End-to-end P2P</span>
          <span className={styles.pill}><Zap size={12} /> Instant connect</span>
          <span className={styles.pill}><Shield size={12} /> No sign-up</span>
        </div>
      </div>

      <div className={`${styles.card} glass`}>
        <span className={styles.sectionLabel}>Your name</span>

        <div className={styles.nameRow}>
          <div className={styles.avatarPreview}>
            {initial ? (
              <span className={styles.avatarInitial}>{initial}</span>
            ) : (
              <User size={18} color="var(--text-muted)" />
            )}
          </div>
          <input
            id="name-input"
            type="text"
            className={`input-field ${styles.nameInput}`}
            placeholder="Enter your name…"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            maxLength={20}
            autoFocus
          />
        </div>

        <div className={styles.dividerThick} />

        <span className={styles.sectionLabel}>Start a conversation</span>

        <button className={`btn-primary ${styles.createBtn}`} onClick={handleCreateRoom}>
          <Video size={18} />
          Create New Room
        </button>

        <div className={styles.divider}>or join with a code</div>

        <form onSubmit={handleJoinRoom} className={styles.joinRow}>
          <input
            id="join-code-input"
            type="text"
            inputMode="numeric"
            placeholder="000000"
            className={`input-field ${styles.joinInput}`}
            value={joinCode}
            onChange={(e) => {
              setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              setError("");
            }}
            maxLength={6}
          />
          <button id="join-btn" type="submit" className={`btn-primary ${styles.joinBtn}`}>
            <ArrowRight size={18} />
          </button>
        </form>

        {error && (
          <p className={styles.error}>
            <Lock size={14} /> {error}
          </p>
        )}
      </div>
    </div>
  );
}
