import { useState, useEffect, useRef, useCallback } from "react";

export function usePeer(roomId, mode) {
  const [peerId, setPeerId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [error, setError] = useState("");

  const peerInstance = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const myStreamRef = useRef(null);
  const dataConnRef = useRef(null);
  const isConnectedRef = useRef(false);

  const addMessage = useCallback((text, sender) => {
    setMessages((prev) => [...prev, { text, sender, id: Date.now() + Math.random() }]);
  }, []);

  useEffect(() => {
    if (!roomId || !mode) return;

    let peer;
    let myStream;

    // Dynamically import PeerJS (browser-only)
    const init = async () => {
      const { default: Peer } = await import("peerjs");

      try {
        myStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        myStreamRef.current = myStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = myStream;
        }
      } catch (err) {
        setError("Camera/Microphone access denied. Please allow permissions and reload.");
        return;
      }

      if (mode === "host") {
        peer = new Peer(roomId);
        peerInstance.current = peer;

        peer.on("open", (id) => {
          setPeerId(id);
        });

        peer.on("error", (err) => {
          if (err.type === "unavailable-id") {
            setError("This room code is already active. Please create a new room.");
          } else {
            console.warn("Peer error:", err.type, err.message);
          }
        });

        // Host receives call from guest
        peer.on("call", (call) => {
          call.answer(myStream);
          call.on("stream", (remoteStream) => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
            }
          });
          call.on("close", () => {
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
            setIsConnected(false);
            isConnectedRef.current = false;
          });
        });

        // Host receives data connection from guest
        peer.on("connection", (conn) => {
          // reject if another guest is already connected
          if (dataConnRef.current && isConnectedRef.current) {
            conn.close();
            return;
          }
          dataConnRef.current = conn;

          conn.on("open", () => {
            setIsConnected(true);
            isConnectedRef.current = true;
          });

          conn.on("data", (data) => {
            addMessage(data, "other");
          });

          conn.on("close", () => {
            setIsConnected(false);
            isConnectedRef.current = false;
            dataConnRef.current = null;
          });

          conn.on("error", (err) => {
            console.warn("Data connection error:", err);
          });
        });

      } else if (mode === "guest") {
        peer = new Peer();
        peerInstance.current = peer;

        peer.on("open", (id) => {
          setPeerId(id);

          // Guest calls host with video
          const call = peer.call(roomId, myStream);
          if (!call) {
            setError("Could not reach the host. The room may not exist.");
            return;
          }
          call.on("stream", (remoteStream) => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
            }
          });
          call.on("close", () => {
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
            setIsConnected(false);
            isConnectedRef.current = false;
          });

          // Guest opens data connection to host
          const conn = peer.connect(roomId, { reliable: true });
          dataConnRef.current = conn;

          conn.on("open", () => {
            setIsConnected(true);
            isConnectedRef.current = true;
          });

          conn.on("data", (data) => {
            addMessage(data, "other");
          });

          conn.on("close", () => {
            setIsConnected(false);
            isConnectedRef.current = false;
            dataConnRef.current = null;
          });

          conn.on("error", (err) => {
            console.warn("Data connection error:", err);
          });
        });

        peer.on("error", (err) => {
          if (err.type === "peer-unavailable") {
            setError("Room not found. Make sure the code is correct and the host is online.");
          } else {
            console.warn("Peer error:", err.type, err.message);
          }
        });
      }
    };

    init();

    return () => {
      if (peer) peer.destroy();
      if (myStream) myStream.getTracks().forEach((t) => t.stop());
      dataConnRef.current = null;
      isConnectedRef.current = false;
    };
  }, [roomId, mode, addMessage]);

  const sendMessage = useCallback((msg) => {
    const conn = dataConnRef.current;
    if (conn && conn.open) {
      conn.send(msg);
      addMessage(msg, "self");
      return true;
    } else {
      console.warn("sendMessage called but connection is not open yet.");
      return false;
    }
  }, [addMessage]);

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
  };
}
