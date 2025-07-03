import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";

// Change these to your test user IDs
const USER_ID = "6866a789ed224bc42820cbc9";
const OTHER_USER_ID = "6866a8a0cca934b2567caac1";
const GENERAL_ROOM_ID = "6866ddcbef2398c4c05d9ed2"; // <--- Your General Room ID

const API_BASE = "https://futuristic-chat-app-production.up.railway.app";
const SOCKET_SERVER_URL = "https://futuristic-chat-app-production.up.railway.app";

const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "es", name: "Spanish" },
  { code: "it", name: "Italian" },
  { code: "ro", name: "Romanian" },
  { code: "hu", name: "Hungarian" },
  { code: "ru", name: "Russian" },
  { code: "pl", name: "Polish" },
  { code: "tr", name: "Turkish" },
  { code: "uk", name: "Ukrainian" },
  { code: "pt", name: "Portuguese" },
  { code: "bg", name: "Bulgarian" },
  { code: "cs", name: "Czech" },
  { code: "el", name: "Greek" },
  { code: "sv", name: "Swedish" },
  { code: "fi", name: "Finnish" },
  { code: "da", name: "Danish" },
  { code: "nl", name: "Dutch" },
  { code: "sk", name: "Slovak" },
  { code: "hr", name: "Croatian" },
  { code: "sr", name: "Serbian" },
  { code: "sl", name: "Slovenian" },
  { code: "no", name: "Norwegian" }
];

function getInitials(name) {
  if (!name) return "?";
  const parts = name.split(" ");
  return parts.map((p) => p[0]).join("").toUpperCase();
}

function formatTime(dateString) {
  const d = new Date(dateString);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function App() {
  const [friends, setFriends] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [privateRooms, setPrivateRooms] = useState([]);
  const [inviteId, setInviteId] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomMembers] = useState([USER_ID, OTHER_USER_ID]);
  const [message, setMessage] = useState("");
  const [selectedRoom, setSelectedRoom] = useState(GENERAL_ROOM_ID); // Default to General Room
  const [roomMessages, setRoomMessages] = useState([]);
  const [senderName, setSenderName] = useState("");
  const [info, setInfo] = useState("");
  const [notification, setNotification] = useState("");
  const [userLanguage, setUserLanguage] = useState("en");
  const [callActive, setCallActive] = useState(false);
  const [callIncoming, setCallIncoming] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);

  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Fetch friends, invitations, and rooms on load
  useEffect(() => {
    fetchFriends();
    fetchRooms();
    getSenderName();
    fetchUserLanguage();
  }, []);

  // Connect to Socket.IO
  useEffect(() => {
    const socket = io(SOCKET_SERVER_URL);
    socketRef.current = socket;

    // Listen for messages for any room
    socket.on("room message", ({ roomId, message, sender, sentAt }) => {
      if (roomId === selectedRoom) {
        setRoomMessages((prev) => [...prev, { message, sender, sentAt }]);
      } else {
        setNotification(`New message in another room!`);
      }
    });

    // Video call signaling
    socket.on("video-offer", handleVideoOffer);
    socket.on("video-answer", handleVideoAnswer);
    socket.on("ice-candidate", handleNewICECandidateMsg);
    socket.on("call-ended", handleCallEnded);
    socket.on("call-incoming", () => setCallIncoming(true));

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line
  }, [selectedRoom]);

  // Join a room and fetch chat history when selectedRoom changes
  useEffect(() => {
    const fetchHistory = async () => {
      if (selectedRoom) {
        if (socketRef.current) {
          socketRef.current.emit("join room", selectedRoom);
        }
        try {
          const res = await axios.get(`${API_BASE}/friends/room/messages/${selectedRoom}`);
          setRoomMessages(
            res.data.messages.map((msg) => ({
              message: msg.message,
              sender: msg.sender,
              sentAt: msg.sentAt,
            }))
          );
          setInfo(`Joined room: ${getRoomName(selectedRoom)}`);
        } catch {
          setRoomMessages([]);
          setInfo("Error fetching chat history");
        }
      }
    };
    fetchHistory();
    // eslint-disable-next-line
  }, [selectedRoom]);

  // Notification for new friend invitations
  useEffect(() => {
    if (pendingInvitations.length > 0) {
      setNotification("You have a new friend request!");
    }
  }, [pendingInvitations.length]);

  // Attach video streams to video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [localStream, remoteStream]);

  const getSenderName = async () => {
    try {
      const res = await axios.get(`${API_BASE}/friends/list/${USER_ID}`);
      if (res.data && res.data.friends) {
        const user = res.data.friends.find((f) => f._id === USER_ID);
        setSenderName(user ? `${user.firstName} ${user.lastName}` : "You");
      }
    } catch {
      setSenderName("You");
    }
  };

  const fetchUserLanguage = async () => {
    try {
      const res = await axios.get(`${API_BASE}/users/${USER_ID}`);
      if (res.data && res.data.language) {
        setUserLanguage(res.data.language);
      }
    } catch {
      setUserLanguage("en");
    }
  };

  const updateLanguage = async (lang) => {
    setUserLanguage(lang);
    try {
      await axios.post(`${API_BASE}/users/update-language`, {
        userId: USER_ID,
        language: lang,
      });
      setInfo("Language updated!");
    } catch {
      setInfo("Error updating language");
    }
  };

  const getRoomName = (roomId) => {
    if (roomId === GENERAL_ROOM_ID) return "General Room";
    const room = privateRooms.find((r) => r._id === roomId);
    return room ? room.name : "";
  };

  const fetchFriends = async () => {
    try {
      const res = await axios.get(`${API_BASE}/friends/list/${USER_ID}`);
      setFriends(res.data.friends);
      setPendingInvitations(res.data.pendingInvitations);
      setInfo("");
    } catch (err) {
      setInfo("Error fetching friends");
    }
  };

  const fetchRooms = async () => {
    try {
      const res = await axios.get(`${API_BASE}/friends/rooms/${USER_ID}`);
      setPrivateRooms(res.data.privateRooms);
      setInfo("");
    } catch (err) {
      setInfo("Error fetching rooms");
    }
  };

  const sendInvitation = async () => {
    if (!inviteId) return;
    try {
      await axios.post(`${API_BASE}/friends/invite`, {
        fromUserId: USER_ID,
        toUserId: inviteId,
      });
      setInfo("Invitation sent!");
      setInviteId("");
      fetchFriends();
    } catch (err) {
      setInfo("Error sending invitation");
    }
  };

  const acceptInvitation = async (fromUserId) => {
    try {
      await axios.post(`${API_BASE}/friends/accept`, {
        userId: USER_ID,
        fromUserId,
      });
      setInfo("Invitation accepted!");
      fetchFriends();
    } catch (err) {
      setInfo("Error accepting invitation");
    }
  };

  const removeFriend = async (friendId) => {
    try {
      await axios.post(`${API_BASE}/friends/remove`, {
        userId: USER_ID,
        friendId,
      });
      setInfo("Friend removed!");
      fetchFriends();
    } catch (err) {
      setInfo("Error removing friend");
    }
  };

  const createRoom = async () => {
    if (!roomName || roomMembers.length < 2) {
      setInfo("Room name and at least 2 members required");
      return;
    }
    try {
      await axios.post(`${API_BASE}/friends/room`, {
        name: roomName,
        memberIds: roomMembers,
      });
      setInfo("Room created!");
      setRoomName("");
      fetchRooms();
    } catch (err) {
      setInfo("Error creating room");
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (message.trim() && socketRef.current && selectedRoom) {
      const sentAt = new Date().toISOString();
      socketRef.current.emit("room message", {
        roomId: selectedRoom,
        message,
        sender: senderName || "You",
        sentAt,
      });
      try {
        await axios.post(`${API_BASE}/friends/room/message`, {
          roomId: selectedRoom,
          message,
          sender: senderName || "You",
          sentAt,
        });
      } catch {}
      setRoomMessages((prev) => [
        ...prev,
        { message, sender: senderName || "You", sentAt },
      ]);
      setMessage("");
    }
  };

  // --- Video Call Logic ---

  const startCall = async () => {
    setCallActive(true);
    const pc = createPeerConnection();
    setPeerConnection(pc);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    } catch (err) {
      alert("Could not access camera/microphone.");
      setCallActive(false);
      return;
    }

    pc.onnegotiationneeded = async () => {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current.emit("video-offer", {
        offer,
        to: OTHER_USER_ID,
        from: USER_ID,
      });
    };
  };

  const handleVideoOffer = async ({ offer, from }) => {
    setCallIncoming(true);
    window.answerCall = async () => {
      setCallActive(true);
      setCallIncoming(false);
      const pc = createPeerConnection();
      setPeerConnection(pc);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      } catch (err) {
        alert("Could not access camera/microphone.");
        setCallActive(false);
        return;
      }

      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current.emit("video-answer", {
        answer,
        to: from,
        from: USER_ID,
      });
    };
  };

  const handleVideoAnswer = async ({ answer }) => {
    if (peerConnection) {
      await peerConnection.setRemoteDescription(answer);
    }
  };

  const handleNewICECandidateMsg = async ({ candidate }) => {
    if (peerConnection && candidate) {
      try {
        await peerConnection.addIceCandidate(candidate);
      } catch (e) {}
    }
  };

  const handleCallEnded = () => {
    setCallActive(false);
    setCallIncoming(false);
    setRemoteStream(null);
    setLocalStream(null);
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }
  };

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection();
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit("ice-candidate", {
          candidate: event.candidate,
          to: OTHER_USER_ID,
          from: USER_ID,
        });
      }
    };
    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };
    return pc;
  };

  const endCall = () => {
    socketRef.current.emit("call-ended", { to: OTHER_USER_ID, from: USER_ID });
    handleCallEnded();
  };

  const clearNotification = () => setNotification("");

  return (
    <div style={{ maxWidth: 700, margin: "40px auto", fontFamily: "Arial, sans-serif" }}>
      {/* Notification Bar */}
      {notification && (
        <div
          style={{
            background: "#fffae6",
            color: "#856404",
            padding: "10px 20px",
            borderRadius: 8,
            marginBottom: 20,
            border: "1px solid #ffeeba",
            fontWeight: "bold",
            cursor: "pointer",
          }}
          onClick={clearNotification}
        >
          {notification} (click to dismiss)
        </div>
      )}

      <h2>Friends & Private Rooms</h2>

      {/* Language Selector */}
      <div style={{ marginBottom: 20 }}>
        <label>
          <b>Your Language: </b>
          <select
            value={userLanguage}
            onChange={(e) => updateLanguage(e.target.value)}
            style={{ marginLeft: 8, padding: 4, borderRadius: 4 }}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {info && <div style={{ color: "green", marginBottom: 10 }}>{info}</div>}

      <section style={{ marginBottom: 30 }}>
        <h3>Your Friends</h3>
        <ul>
          {friends.map((f) => (
            <li key={f._id}>
              <span
                style={{
                  display: "inline-block",
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "#007bff",
                  color: "#fff",
                  textAlign: "center",
                  lineHeight: "28px",
                  marginRight: 8,
                  fontWeight: "bold",
                }}
              >
                {getInitials(`${f.firstName} ${f.lastName}`)}
              </span>
              {f.firstName} {f.lastName} ({f.email})
              <button
                style={{
                  marginLeft: 10,
                  color: "white",
                  background: "red",
                  border: "none",
                  borderRadius: 4,
                  padding: "2px 8px",
                  cursor: "pointer",
                }}
                onClick={() => removeFriend(f._id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginBottom: 30 }}>
        <h3>Pending Invitations</h3>
        <ul>
          {pendingInvitations.map((inv) => (
            <li key={inv._id}>
              <span
                style={{
                  display: "inline-block",
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "#6c757d",
                  color: "#fff",
                  textAlign: "center",
                  lineHeight: "28px",
                  marginRight: 8,
                  fontWeight: "bold",
                }}
              >
                {getInitials(`${inv.firstName} ${inv.lastName}`)}
              </span>
              {inv.firstName} {inv.lastName} ({inv.email}){" "}
              <button onClick={() => acceptInvitation(inv._id)}>Accept</button>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginBottom: 30 }}>
        <h3>Send Friend Invitation</h3>
        <input
          type="text"
          placeholder="Enter user ID to invite"
          value={inviteId}
          onChange={(e) => setInviteId(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <button onClick={sendInvitation}>Send Invitation</button>
      </section>

      <section style={{ marginBottom: 30 }}>
        <h3>Chat Rooms</h3>
        <ul>
          <li>
            <b>General Room</b>
            <button
              style={{ marginLeft: 10 }}
              onClick={() => setSelectedRoom(GENERAL_ROOM_ID)}
            >
              Chat
            </button>
          </li>
          {privateRooms.map((room) => (
            <li key={room._id}>
              <b>{room.name}</b> (Members:{" "}
              {room.members.map((m) => `${m.firstName} ${m.lastName}`).join(", ")})
              <button
                style={{ marginLeft: 10 }}
                onClick={() => setSelectedRoom(room._id)}
              >
                Chat
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Create Private Room</h3>
        <input
          type="text"
          placeholder="Room name"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <button onClick={createRoom}>Create Room</button>
        <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
          (Room will include you and the other test user)
        </div>
      </section>

      {selectedRoom && (
        <section style={{ marginTop: 40 }}>
          <h3>Chat in: {getRoomName(selectedRoom)}</h3>
          <div
            style={{
              border: "1px solid #ccc",
              borderRadius: 8,
              padding: 16,
              minHeight: 200,
              marginBottom: 16,
              background: "#f9f9f9",
              overflowY: "auto",
              height: 300,
            }}
          >
            {roomMessages.map((msg, idx) => (
              <div key={idx} style={{ margin: "8px 0", display: "flex", alignItems: "center" }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "#17a2b8",
                    color: "#fff",
                    textAlign: "center",
                    lineHeight: "28px",
                    marginRight: 8,
                    fontWeight: "bold",
                  }}
                >
                  {getInitials(msg.sender)}
                </span>
                <b>{msg.sender}:</b>
                <span style={{ marginLeft: 6 }}>{msg.message}</span>
                <span style={{ marginLeft: "auto", fontSize: 12, color: "#888" }}>
                  {msg.sentAt ? formatTime(msg.sentAt) : ""}
                </span>
              </div>
            ))}
          </div>
          <form onSubmit={handleSendMessage} style={{ display: "flex" }}>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              style={{
                flex: 1,
                padding: 8,
                borderRadius: 4,
                border: "1px solid #ccc",
                marginRight: 8,
              }}
            />
            <button
              type="submit"
              style={{
                padding: "8px 16px",
                borderRadius: 4,
                border: "none",
                background: "#007bff",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Send
            </button>
          </form>
          {/* Video Call UI */}
          <div style={{ marginTop: 20 }}>
            {!callActive && !callIncoming && (
              <button onClick={startCall} style={{ background: "#28a745", color: "#fff", padding: "8px 16px", borderRadius: 4, border: "none", cursor: "pointer" }}>
                Start Video Call
              </button>
            )}
            {callIncoming && !callActive && (
              <div>
                <b>Incoming call...</b>
                <button onClick={window.answerCall} style={{ marginLeft: 10, background: "#007bff", color: "#fff", padding: "8px 16px", borderRadius: 4, border: "none", cursor: "pointer" }}>
                  Answer
                </button>
                <button onClick={handleCallEnded} style={{ marginLeft: 10, background: "#dc3545", color: "#fff", padding: "8px 16px", borderRadius: 4, border: "none", cursor: "pointer" }}>
                  Decline
                </button>
              </div>
            )}
            {callActive && (
              <div style={{ marginTop: 20 }}>
                <div>
                  <video ref={localVideoRef} autoPlay muted style={{ width: 200, borderRadius: 8, marginRight: 10 }} />
                  <video ref={remoteVideoRef} autoPlay style={{ width: 200, borderRadius: 8 }} />
                </div>
                <button onClick={endCall} style={{ marginTop: 10, background: "#dc3545", color: "#fff", padding: "8px 16px", borderRadius: 4, border: "none", cursor: "pointer" }}>
                  End Call
                </button>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export default App;