const http = require('http');
const cors = require('cors');
const Sequelize = require('sequelize');
const socketIo = require('socket.io');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL);

const Message = sequelize.define('communications', {
    id: { type: Sequelize.DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
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
}, { timestamps: false });

sequelize.authenticate().then(() => {
    console.log("Connection has been established successfully.");
    Message.sync();
    createServer();
}).catch((err) => {
    console.error("Unable to connect to the database:", err);
});

function createServer() {
    const httpServer = http.createServer((req, res) => {
        cors()(req, res, () => {
            if (req.url.startsWith('/messages')) {
                const url = new URL(req.url, `http://${req.headers.host}`);
                const applicantId = url.searchParams.get('applicant_id');

                if (applicantId) {
                    fetchMessagesByApplicantId(applicantId).then((messages) => {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(messages));
                    }).catch(err => {
                        res.writeHead(500);
                        res.end(JSON.stringify({ error: err.message }));
                    });
                } else {
                    fetchMessages().then((messages) => {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(messages));
                    }).catch(err => {
                        res.writeHead(500);
                        res.end(JSON.stringify({ error: err.message }));
                    });
                }
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Not Found' }));
            }
        });
    });

    const io = socketIo(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
    });

    io.on('connection', (socket) => {
        console.log('A user connected.');

        socket.on('message', (msg) => {
            if (msg.applicant_id) {
                Message.create(msg).then(() => {
                    io.to(`applicant_${msg.applicant_id}`).emit('message', msg);
                });
            }
        });

        socket.on('join', (applicantId) => {
            socket.join(`applicant_${applicantId}`);
            console.log(`User joined room applicant_${applicantId}`);
        });

        socket.on('disconnect', () => {
            console.log('A user disconnected.');
        });
    });

    httpServer.listen(3005, () => console.log('Listening on port 3005'));
}

function fetchMessages() {
    return Message.findAll();
}

function fetchMessagesByApplicantId(applicantId) {
    return Message.findAll({ where: { applicant_id: applicantId } });
}
