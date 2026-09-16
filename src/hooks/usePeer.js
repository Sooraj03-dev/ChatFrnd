import { useState, useEffect, useRef, useCallback } from "react";

/**
 * ICE servers for NAT traversal.
 */
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478" },
  { urls: "stun:stun.services.mozilla.com" },
  {
    urls: "turn:a.relay.metered.ca:80",
    username: "e8dd65b92aad9a39368b7a05",
    credential: "BkZhOCs+crX0YwJk",
  },
  {
    urls: "turn:a.relay.metered.ca:443",
    username: "e8dd65b92aad9a39368b7a05",
    credential: "BkZhOCs+crX0YwJk",
  },
  {
    urls: "turn:a.relay.metered.ca:443?transport=tcp",
    username: "e8dd65b92aad9a39368b7a05",
    credential: "BkZhOCs+crX0YwJk",
  },
];

const GUEST_RETRY_DELAY = 2000;
const GUEST_MAX_RETRIES = 5;

/**
 * Message types sent over the data channel:
 *   { type: "username", name: "Sooraj" }       — identity exchange
 *   { type: "chat",     text: "Hello!" }        — chat message
 */

export function usePeer(roomId, mode, myName) {
  const [peerId, setPeerId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [error, setError] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("initializing");
  const [remoteName, setRemoteName] = useState("");

  const peerInstance = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const myStreamRef = useRef(null);
  const dataConnRef = useRef(null);
  const mediaCallRef = useRef(null);
  const isConnectedRef = useRef(false);
  const cleanedUp = useRef(false);
  const myNameRef = useRef(myName);

  // Keep ref in sync
  useEffect(() => {
    myNameRef.current = myName;
  }, [myName]);

  const addMessage = useCallback((text, sender, senderName) => {
    setMessages((prev) => [
      ...prev,
      { text, sender, senderName, id: Date.now() + Math.random() },
    ]);
  }, []);

  useEffect(() => {
    if (!roomId || !mode) return;

    cleanedUp.current = false;
    let peer;
    let myStream;
    let retryTimer;
    let retryCount = 0;

    const log = (...args) => console.log(`[usePeer:${mode}]`, ...args);

    const setRemoteStream = (remoteStream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        // Mobile browsers (iOS Safari, Android Chrome) can sometimes pause unmuted videos.
        // We explicitly tell the browser to play it.
        remoteVideoRef.current.play().catch((err) => {
          console.warn("Failed to auto-play remote video:", err);
        });
      }
    };

    const markConnected = () => {
      if (!isConnectedRef.current) {
        log("✅ Connected!");
        setIsConnected(true);
        isConnectedRef.current = true;
        setConnectionStatus("connected");
      }
    };

    const markDisconnected = () => {
      log("❌ Disconnected");
      setIsConnected(false);
      isConnectedRef.current = false;
      setConnectionStatus("disconnected");
      setRemoteName("");
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    };

    const handleDataMessage = (data) => {
      // Structured message protocol
      if (data && typeof data === "object" && data.type) {
        switch (data.type) {
          case "username":
            log("Received remote name:", data.name);
            setRemoteName(data.name || "Friend");
            break;
          case "chat":
            addMessage(data.text, "other", data.senderName || "Friend");
            break;
          default:
            log("Unknown message type:", data.type);
        }
      } else if (typeof data === "string") {
        // Legacy fallback: plain string = chat
        addMessage(data, "other", "Friend");
      }
    };

    const sendUsername = (conn) => {
      // Small delay to ensure connection is fully ready
      setTimeout(() => {
        if (conn && conn.open) {
          conn.send({ type: "username", name: myNameRef.current || "Friend" });
          log("Sent username:", myNameRef.current);
        }
      }, 300);
    };

    const setupDataConnection = (conn) => {
      dataConnRef.current = conn;

      conn.on("open", () => {
        log("Data channel open");
        markConnected();
        sendUsername(conn);
      });

      conn.on("data", (data) => {
        handleDataMessage(data);
      });

      conn.on("close", () => {
        log("Data channel closed");
        markDisconnected();
        dataConnRef.current = null;
      });

      conn.on("error", (err) => {
        console.warn("Data connection error:", err);
      });
    };

    const setupMediaCall = (call) => {
      mediaCallRef.current = call;

      call.on("stream", (remoteStream) => {
        log("Received remote media stream");
        setRemoteStream(remoteStream);
        markConnected();
      });

      call.on("close", () => {
        log("Media call closed");
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      });

      call.on("error", (err) => {
        console.warn("Media call error:", err);
      });
    };

    const init = async () => {
      const { default: Peer } = await import("peerjs");

      try {
        myStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        myStreamRef.current = myStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = myStream;
        }
      } catch (err) {
        setError(
          "Camera/Microphone access denied. Please allow permissions and reload."
        );
        setConnectionStatus("error");
        return;
      }

      const peerConfig = {
        config: {
          iceServers: ICE_SERVERS,
        },
        debug: 1,
      };

      if (mode === "host") {
        peer = new Peer(roomId, peerConfig);
        peerInstance.current = peer;

        peer.on("open", (id) => {
          log("Host registered with ID:", id);
          setPeerId(id);
          setConnectionStatus("waiting");
        });

        peer.on("error", (err) => {
          log("Host error:", err.type, err.message);
          if (err.type === "unavailable-id") {
            setError(
              "This room code is already active. Please create a new room."
            );
            setConnectionStatus("error");
          } else if (err.type === "network" || err.type === "server-error") {
            setError(
              "Cannot connect to signaling server. Check your internet connection."
            );
            setConnectionStatus("error");
          }
        });

        peer.on("call", (call) => {
          log("Incoming call from guest – answering");
          call.answer(myStream);
          setupMediaCall(call);
        });

        peer.on("connection", (conn) => {
          if (dataConnRef.current && isConnectedRef.current) {
            log("Rejecting extra guest connection");
            conn.close();
            return;
          }
          log("Incoming data connection from guest");
          setupDataConnection(conn);
        });

        peer.on("disconnected", () => {
          log("Disconnected from signaling server, attempting reconnect...");
          if (!cleanedUp.current && peer && !peer.destroyed) {
            peer.reconnect();
          }
        });
      } else if (mode === "guest") {
        peer = new Peer(peerConfig);
        peerInstance.current = peer;

        const connectToHost = () => {
          if (cleanedUp.current || !peer || peer.destroyed) return;

          log(
            `Attempting to connect to host (attempt ${retryCount + 1}/${GUEST_MAX_RETRIES})...`
          );
          setConnectionStatus("connecting");

          const call = peer.call(roomId, myStream);
          if (!call) {
            log("peer.call() returned null – host not found");
            handleRetry();
            return;
          }
          setupMediaCall(call);

          const conn = peer.connect(roomId, {
            reliable: true,
            serialization: "json",
          });
          setupDataConnection(conn);

          const timeout = setTimeout(() => {
            if (!isConnectedRef.current && !cleanedUp.current) {
              log("Connection timeout – retrying");
              conn.close();
              handleRetry();
            }
          }, 8000);

          conn.on("open", () => clearTimeout(timeout));
        };

        const handleRetry = () => {
          retryCount++;
          if (retryCount >= GUEST_MAX_RETRIES) {
            setError(
              "Could not reach the host after multiple attempts. Make sure the host has the room open and try again."
            );
            setConnectionStatus("error");
            return;
          }
          retryTimer = setTimeout(connectToHost, GUEST_RETRY_DELAY);
        };

        peer.on("open", (id) => {
          log("Guest registered with ID:", id);
          setPeerId(id);
          connectToHost();
        });

        peer.on("error", (err) => {
          log("Guest error:", err.type, err.message);
          if (err.type === "peer-unavailable") {
            handleRetry();
          } else if (err.type === "network" || err.type === "server-error") {
            setError(
              "Cannot connect to signaling server. Check your internet connection."
            );
            setConnectionStatus("error");
          }
        });

        peer.on("disconnected", () => {
          log("Disconnected from signaling server, attempting reconnect...");
          if (!cleanedUp.current && peer && !peer.destroyed) {
            peer.reconnect();
          }
        });
      }
    };

    init();

    return () => {
      cleanedUp.current = true;
      clearTimeout(retryTimer);
      if (mediaCallRef.current) mediaCallRef.current.close();
      if (dataConnRef.current) dataConnRef.current.close();
      if (peer && !peer.destroyed) peer.destroy();
      if (myStream) myStream.getTracks().forEach((t) => t.stop());
      dataConnRef.current = null;
      mediaCallRef.current = null;
      isConnectedRef.current = false;
    };
  }, [roomId, mode, addMessage]);

  const sendMessage = useCallback(
    (msg) => {
      const conn = dataConnRef.current;
      if (conn && conn.open) {
        conn.send({
          type: "chat",
          text: msg,
          senderName: myNameRef.current || "You",
        });
        addMessage(msg, "self", myNameRef.current || "You");
        return true;
      } else {
        console.warn("sendMessage called but connection is not open yet.");
        return false;
      }
    },
    [addMessage]
  );

  const toggleMute = useCallback(() => {
    const stream = myStreamRef.current;
    if (stream) {
      const track = stream.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsMuted(!track.enabled);
      }
    }
  }, []);

  const toggleVideo = useCallback(() => {
    const stream = myStreamRef.current;
    if (stream) {
      const track = stream.getVideoTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsVideoOff(!track.enabled);
      }
    }
  }, []);

  return {
    peerId,
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
    connectionStatus,
    remoteName,
  };
}
