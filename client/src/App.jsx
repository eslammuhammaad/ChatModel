import "./App.css";
import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";

function App() {
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const location = useLocation();
  const [applicantId, setApplicantId] = useState(null);
  const [senderFullname, setSenderFullname] = useState(null);
  const [senderType, setSenderType] = useState(null);
  const [senderPhoto, setSenderPhoto] = useState(null);
  const [senderId, setSenderId] = useState(null);

  const [message, setMessage] = useState({
    timestamp: "",
    status: "",
    activity_url: "",
    application_id: null,
    applicant_id: null,
    communication_type: "",
    channel: "",
    message_content: "",
    thread_id: "",
    sender_fullname: "",
    sender_type: "",
    sender_photo: "",
    sender_id: "",
    date_timestamp: new Date().toISOString()
  });

  const socket = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const id = queryParams.get("applicant_id");
    const name = queryParams.get("name"); 
    const type = queryParams.get("type");
    const photo = queryParams.get("photo");
    const sender_id = queryParams.get("sender_id");

    if (id && name && type && photo && sender_id) {
      setApplicantId(id);
      setSenderFullname(name);
      setSenderType(type);
      setSenderPhoto(photo);
      setSenderId(sender_id);

      // Update message state with user details
      setMessage((prevMessage) => ({
        ...prevMessage,
        applicant_id: id,
        sender_fullname: name,
        sender_type: type,
        sender_photo: photo,
        sender_id: sender_id
      }));
    }
  }, [location]);

  useEffect(() => {
    socket.current = new WebSocket("ws://localhost:3005");

    socket.current.onopen = () => {
      console.log("Connected successfully.");
    };

    socket.current.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.applicant_id === applicantId) {
        setMessages((prevMessages) => [...prevMessages, msg]);
      }
    };

    return () => {
      socket.current.close();
    };
  }, [applicantId]);

  useEffect(() => {
    if (applicantId) {
      fetchMessages();
    }
  }, [applicantId]);

  const sendMessage = () => {
    if (messageInput.trim() === "") return;

    setMessage((prevMessage) => ({
      ...prevMessage,
      message_content: messageInput,
      date_timestamp: new Date().toISOString()
    }));

    // Send the updated message
    socket.current.send(JSON.stringify({
      ...message,
      message_content: messageInput,
      date_timestamp: new Date().toISOString()
    }));
    
    setMessageInput("");
  };

  const fetchMessages = () => {
    fetch(`http://localhost:3005/messages?applicant_id=${applicantId}`)
      .then((res) => res.json())
      .then((data) => setMessages(data));
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="App">
      <div className="chat-container">
        <div className="chat-messages">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`message ${message.sender_id === senderId ? "sent" : "received"}`}
            >
              <span className="message-timestamp">
                {message.sender_fullname} - {formatDate(message.date_timestamp)}
              </span>
              <span className="message-content">{message.message_content}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <div className="chat-input">
          <input
            type="text"
            placeholder="Type your message"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && messageInput.trim() !== "") {
                sendMessage();
              }
            }}
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>
    </div>
  );
}

export default App;
