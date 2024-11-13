import "./App.css";
import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { io } from "socket.io-client";
import Select from "react-select";
import makeAnimated from "react-select/animated";

function App() {
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const location = useLocation();
  const [applicantId, setApplicantId] = useState(null);
  const [senderFullname, setSenderFullname] = useState(null);
  const [senderType, setSenderType] = useState(null);
  const [senderPhoto, setSenderPhoto] = useState(null);
  const [senderId, setSenderId] = useState(null);
  const [contactType, setContactType] = useState(null);
  const [communicationType, setCommunicationType] =
    useState("Lead Communication");
  const [internals, setInternals] = useState(null);
  const [selectedInternals, setSelectedInternals] = useState(null);

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
    date_timestamp: new Date().toISOString(),
  });

  const socket = useRef(null);
  const chatEndRef = useRef(null);

  const animatedComponents = makeAnimated();

  const socketUrl = import.meta.env.VITE_SOCKET_URL;
  const webhookUrl = import.meta.env.VITE_HOOK_URL;


  const internal_name = internals?.map((internal) => {
    return { value: internal.full_name, label: internal.full_name };
  });

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const id = queryParams.get("applicant_id");
    const name = queryParams.get("name");
    const type = queryParams.get("type");
    const photo = queryParams.get("photo");
    const sender_id = queryParams.get("sender_id");
    const contactType = queryParams.get("contact_type");

    if (id && name && type && photo && sender_id) {
      setApplicantId(id);
      setSenderFullname(name);
      setSenderType(type);
      setSenderPhoto(photo);
      setSenderId(sender_id);
      setContactType(contactType);

      setMessage((prevMessage) => ({
        ...prevMessage,
        applicant_id: id,
        sender_fullname: name,
        sender_type: type,
        sender_photo: photo,
        sender_id: sender_id,
      }));
    }
  }, [location]);

  useEffect(() => {
    socket.current = io(socketUrl);
    if (applicantId) {
      socket.current.emit("join", applicantId);
      socket.current.on("message", (msg) => {
        if (msg.applicant_id === applicantId) {
          setMessages((prevMessages) => [...prevMessages, msg]);
        }
      });
    }

    return () => {
      socket.current.disconnect();
    };
  }, [applicantId]);

  useEffect(() => {
    setMessage((prevMessage) => ({
      ...prevMessage,
      communication_type: communicationType,
    }));
  }, [communicationType]);

  useEffect(() => {
    if (applicantId) {
      fetchMessages();
    }
  }, [applicantId]);

  useEffect(() => {
    fetchInternals();
  }, []);

  const sendMessage = () => {
    if (messageInput.trim() === "") return;
    
    setMessage((prevMessage) => ({
      ...prevMessage,
      message_content: messageInput,
      date_timestamp: new Date().toISOString(),
    }));

    socket.current.emit("message", {
      ...message,
      message_content: messageInput,
      date_timestamp: new Date().toISOString(),
    });

    // Add selectedInternals if they exist
    if (selectedInternals && selectedInternals.length > 0) {
      const messagePayload = {
        ...message,
        message_content: messageInput,
        date_timestamp: new Date().toISOString(),
        selected_internals: selectedInternals
        ? selectedInternals.map((internal) => internal.value)
        : [],
      };
     
      // Send message to the webhook
      fetch(
        webhookUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(messagePayload),
        }
      )
        .then((response) => {
          if (!response.ok) {
            console.error("Webhook request failed");
          }
        })
        .catch((error) => {
          console.error("Error sending webhook request:", error);
        });
    }
    setMessageInput("");
  };

  const fetchMessages = () => {
    fetch(`${socketUrl}/messages?applicant_id=${applicantId}`)
      .then((res) => res.json())
      .then((data) => setMessages(data));
  };
  const fetchInternals = () => {
    fetch(`${socketUrl}/contacts/internal`)
      .then((res) => res.json())
      .then((data) => setInternals(data));
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
        {contactType === "Internal" && (
          <div className="dropdown-container">
            <div>
              <select
                className="communication-dropdown"
                value={communicationType}
                onChange={(e) => setCommunicationType(e.target.value)}
              >
                <option value="Lead Communication">Lead Communication</option>
                <option value="Internal Communication">
                  Internal Communication
                </option>
              </select>
            </div>
            <div className="react-select-container">
              <Select
                closeMenuOnSelect={false}
                components={animatedComponents}
                defaultValue={""}
                isMulti
                options={internal_name}
                onChange={(selectedOptions) =>
                  setSelectedInternals(selectedOptions)
                }
              />
            </div>
          </div>
        )}
        <div className="chat-messages">
          {messages
            .filter(
              (msg) =>
                contactType !== "Lead" ||
                msg.communication_type === "Lead Communication"
            )
            .map((message, index) => (
              <div
                key={index}
                className={`message ${
                  message.sender_id === senderId ? "sent" : "received"
                }`}
              >
                <span className="message-timestamp">
                  {message.sender_fullname} -{" "}
                  {formatDate(message.date_timestamp)}
                </span>
                <span className="message-content">
                  {message.message_content}
                </span>
              </div>
            ))}
          <div ref={chatEndRef} />
        </div>
        <div className="chat-input">
          <textarea
            type="text"
            placeholder="Type your message"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>
    </div>
  );
}

export default App;
