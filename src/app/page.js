"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Video, Shield, Zap, ArrowRight, Lock } from "lucide-react";
import styles from "./page.module.css";

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default function Home() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");

  const handleCreateRoom = () => {
    const code = generateCode();
    router.push(`/room/${code}?mode=host`);
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    const trimmed = joinCode.trim();
    if (trimmed.length === 6 && /^\d+$/.test(trimmed)) {
      router.push(`/room/${trimmed}?mode=guest`);
    } else {
      setError("Please enter a valid 6-digit numeric code.");
    }
  };

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
          Instant private video calls & chat — no account needed. Just share a 6-digit code.
        </p>
        <div className={styles.features}>
          <span className={styles.pill}><Lock size={12} /> End-to-end P2P</span>
          <span className={styles.pill}><Zap size={12} /> Instant connect</span>
          <span className={styles.pill}><Shield size={12} /> No sign-up</span>
        </div>
      </div>

      <div className={`${styles.card} glass`}>
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
