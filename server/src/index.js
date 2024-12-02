const http = require("http");
const cors = require("cors");
const Sequelize = require("sequelize");
const socketIo = require("socket.io");
require("dotenv").config();

const sequelize = new Sequelize(process.env.DATABASE_URL);

const Message = sequelize.define(
  "communications",
  {
    id: {
      type: Sequelize.DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    timestamp: Sequelize.DataTypes.STRING,
    status: Sequelize.DataTypes.STRING,
    activity_url: Sequelize.DataTypes.STRING,
    application_id: Sequelize.DataTypes.INTEGER,
    applicant_id: Sequelize.DataTypes.INTEGER,
    communication_type: Sequelize.DataTypes.STRING,
    channel: Sequelize.DataTypes.STRING,
    message_content: Sequelize.DataTypes.STRING,
    thread_id: Sequelize.DataTypes.STRING,
    sender_fullname: Sequelize.DataTypes.STRING,
    sender_type: Sequelize.DataTypes.STRING,
    sender_photo: Sequelize.DataTypes.STRING,
    sender_id: Sequelize.DataTypes.STRING,
    date_timestamp: Sequelize.DataTypes.DATE,
  },
  { timestamps: false }
);

const Contact = sequelize.define(
  "contacts",
  {
    id: {
      type: Sequelize.DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    contact_type: Sequelize.DataTypes.STRING,
    first_name: Sequelize.DataTypes.STRING,
    last_name: Sequelize.DataTypes.STRING,
    email: Sequelize.DataTypes.STRING,
    user_id: Sequelize.DataTypes.STRING,
    full_name: Sequelize.DataTypes.STRING,
    owner_id: Sequelize.DataTypes.STRING,
    owner_name: Sequelize.DataTypes.STRING,
    last_updated_timestamp: Sequelize.DataTypes.DATE,
  },
  { timestamps: false }
);

sequelize
  .authenticate()
  .then(() => {
    console.log("Connection has been established successfully.");
    Message.sync();
    Contact.sync();
    createServer();
  })
  .catch((err) => {
    console.error("Unable to connect to the database:", err);
  });

const port = process.env.PORT || 4000;

function createServer() {
  const httpServer = http.createServer((req, res) => {
    cors()(req, res, () => {
      // Existing endpoint: /contacts/update-timestamp
      if (
        req.url.startsWith("/contacts/update-timestamp") &&
        req.method === "POST"
      ) {
        let body = "";

        req.on("data", (chunk) => {
          body += chunk.toString();
        });

        req.on("end", () => {
          const { contactId } = JSON.parse(body);

          if (!contactId) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "contactId is required" }));
            return;
          }

          updateContactTimestamp(contactId)
            .then(() => {
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({ message: "Timestamp updated successfully" })
              );
            })
            .catch((err) => {
              res.writeHead(500);
              res.end(JSON.stringify({ error: err.message }));
            });
        });
      } 
      // New endpoint: /contacts/:id
      else if (req.url.startsWith("/contact/")) {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const contactId = url.pathname.split("/")[2]; // Extract contactId from URL

        if (contactId) {
          fetchContactById(contactId)
            .then((contact) => {
              if (!contact) {
                res.writeHead(404, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Contact not found" }));
              } else {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(contact));
              }
            })
            .catch((err) => {
              res.writeHead(500);
              res.end(JSON.stringify({ error: err.message }));
            });
        } else {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "contactId is required" }));
        }
      } 
      // Existing endpoint: /messages
      else if (req.url.startsWith("/messages")) {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const applicantId = url.searchParams.get("applicant_id");

        if (applicantId) {
          fetchMessagesByApplicantId(applicantId)
            .then((messages) => {
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify(messages));
            })
            .catch((err) => {
              res.writeHead(500);
              res.end(JSON.stringify({ error: err.message }));
            });
        } else {
          fetchMessages()
            .then((messages) => {
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify(messages));
            })
            .catch((err) => {
              res.writeHead(500);
              res.end(JSON.stringify({ error: err.message }));
            });
        }
      } 
      // Existing endpoint: /contacts/internal
      else if (req.url.startsWith("/contacts/internal")) {
        fetchInternalContacts()
          .then((contacts) => {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(contacts));
          })
          .catch((err) => {
            res.writeHead(500);
            res.end(JSON.stringify({ error: err.message }));
          });
      } 
      // Fallback for undefined routes
      else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not Found" }));
      }
    });
  });

  const io = socketIo(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("A user connected.");

    socket.on("message", (msg) => {
      if (msg.applicant_id) {
        Message.create(msg).then(() => {
          io.to(`applicant_${msg.applicant_id}`).emit("message", msg);
        });
      }
    });

    socket.on("join", (applicantId) => {
      socket.join(`applicant_${applicantId}`);
      console.log(`User joined room applicant_${applicantId}`);
    });

    socket.on("disconnect", () => {
      console.log("A user disconnected.");
    });
  });

  httpServer.listen(port, () => console.log(`Listening on port ${port}`));
}

// Function to fetch all messages
function fetchMessages() {
  return Message.findAll();
}

// Function to fetch messages by applicantId
function fetchMessagesByApplicantId(applicantId) {
  return Message.findAll({ where: { applicant_id: applicantId },  order: [['id', 'ASC']],});
}

// Function to fetch internal contacts
function fetchInternalContacts() {
  return Contact.findAll({
    where: { contact_type: "Internal", lead_status: "Active" },
  });
}

// Function to fetch a contact by id
function fetchContactById(contactId) {
  return Contact.findOne({ where: { id: contactId } });
}

// Function to update contact timestamp
function updateContactTimestamp(contactId) {
  return Contact.update(
    { last_updated_timestamp: new Date().toISOString() },
    { where: { id: contactId } }
  );
}
