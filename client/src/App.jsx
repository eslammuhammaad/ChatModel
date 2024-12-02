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
  const [communicationType, setCommunicationType] = useState("");
  const [internals, setInternals] = useState([]);
  const [selectedInternals, setSelectedInternals] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [contact, setContact] = useState(null);

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
    if (contactType === "Lead") {
      setCommunicationType("Lead Communication");
    }
  }, [contactType]);

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
      fetchContact();
    }
  }, [applicantId]);

  useEffect(() => {
    fetchInternals();
  }, []);

  useEffect(() => {
    if (contact && senderId !== contact.owner_id) {
      const ownerOption = {
        value: contact.owner_name,
        label: contact.owner_name,
      };

      // Add to `selectedInternals` if not already present
      setSelectedInternals((prevSelected) => {
        const alreadySelected = prevSelected?.some(
          (internal) => internal.value === ownerOption.value
        );
        return alreadySelected
          ? prevSelected
          : [...(prevSelected || []), ownerOption];
      });

      // Add to `internals` if not already present
      if (
        !internals.some((internal) => internal.full_name === contact.owner_name)
      ) {
        setInternals((prevInternals) => [
          ...(prevInternals || []),
          { full_name: contact.owner_name },
        ]);
      }
    }
  }, [contact, senderId, internals]);

  const sendMessage = () => {
    if (
      !communicationType ||
      communicationType === "Select type of communication"
    ) {
      setErrorMessage("You should select a type of communication.");
      return;
    }

    setErrorMessage(""); // Clear error if validation passes

    if (messageInput.trim() === "") return;

    // Construct message object for WebSocket and webhook
    const newMessage = {
      ...message,
      message_content: messageInput,
      date_timestamp: new Date().toISOString(),
    };

    // Emit message via WebSocket
    socket.current.emit("message", newMessage);

    // Call the webhook if selectedInternals exist
    if (selectedInternals && selectedInternals.length > 0) {
      const messagePayload = {
        ...newMessage,
        selected_internals: selectedInternals.map((internal) => internal.value),
      };

      fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messagePayload),
      }).catch((error) => {
        console.error("Error sending webhook request:", error);
      });
    }

    // Call the backend endpoint to update the contact's last updated timestamp
    fetch(`${socketUrl}/contacts/update-timestamp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ contactId: applicantId }), // Use `applicantId` for `contactId`
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.error) {
          console.error("Error updating timestamp:", data.error);
        } else {
          console.log("Timestamp updated successfully.");
        }
      })
      .catch((error) => {
        console.error("Error calling update-timestamp endpoint:", error);
      });

    setMessageInput(""); // Clear input field
  };

  const fetchMessages = () => {
    fetch(`${socketUrl}/messages?applicant_id=${applicantId}`)
      .then((res) => res.json())
      .then((data) => setMessages(data));
  };

  const fetchContact = () => {
    fetch(`${socketUrl}/contact/${applicantId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.error) {
          setContact(data);
        }
      })
      .catch((error) => console.error("Error fetching contact:", error));
  };

  const fetchInternals = () => {
    fetch(`${socketUrl}/contacts/internal`)
      .then((res) => res.json())
      .then((data) => setInternals(data));
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };
  console.log(selectedInternals);
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
                <option value="">Select type of communication</option>
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
                defaultValue={selectedInternals}
                isMulti
                options={internal_name}
                onChange={(selectedOptions) =>
                  setSelectedInternals(selectedOptions)
                }
              />
            </div>
          </div>
        )}
        {errorMessage && (
          <div className="error-message">
            <span className="icon">⚠️</span> {errorMessage}
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
                } `}
              >
                <span className="message-timestamp">
                  {message.sender_fullname} -{" "}
                  {formatDate(message.date_timestamp)}
                  {contactType === "Internal" &&
                  message.communication_type === "Lead Communication"
                    ? " - Lead Communication"
                    : ""}
                </span>
                <div>
                  {message.sender_id === senderId?"":<img src={message.sender_photo} alt="Description of image" className="sender_photo"/>}
                  <span
                    className={`message-content ${
                      contactType === "Internal" &&
                      message.communication_type === "Lead Communication"
                        ? "lead"
                        : ""
                    }`}
                  >
                    {message.message_content}
                  </span>
                  {message.sender_id === senderId?<img src={message.sender_photo} alt="Description of image" className="sender_photo"/>:""}
                </div>
              </div>
            ))}
          <div ref={chatEndRef} />
        </div>
        <div className="chat-input">
          <textarea
            rows={3}
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="Type your message..."
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>
    </div>
  );
}

export default App;

