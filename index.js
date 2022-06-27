const express = require('express')
const app = express()
const admin = require("firebase-admin");
const cors = require('cors');
require('dotenv').config()
const port = process.env.PORT || 5000
const { MongoClient, ServerApiVersion } = require('mongodb')

const serviceAccount = require("./doctors-portal-firebase-adminsdk.json")
console.log(serviceAccount);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


// middleware
app.use(cors())
app.use(express.json())

// Connection uri
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6jlv6.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const idToken = req.headers.authorization.split('Bearer ')[1];
        try {
            const decodedIdToken = await admin.auth().verifyIdToken(idToken);
            req.decodedEmail = decodedIdToken.email;
        }
        catch (error) {
            console.error("Error while verifying token:", error);
            res.status(403).send("Unauthorized");
        }
    }
    next()
}



async function run() {
    try {
        await client.connect();
        const database = client.db("doctors_portal");
        const appointmentsCollection = database.collection("appointments");
        const portalUsersCollection = database.collection('users')

        // get appointments information
        app.get('/appointments', async (req, res) => {
            const email = req.query.email;
            const date = new Date(req.query.date).toLocaleDateString();
            const query = { email: email, date: date };
            const appointments = await appointmentsCollection.find(query).toArray();
            res.json(appointments);
        })

        // send appointment info to the server
        app.post('/appointments', async (req, res) => {
            const appointment = req.body;
            const result = await appointmentsCollection.insertOne(appointment);
            res.send(result);
        })

        // check if user is admin or not
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const user = await portalUsersCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin });
        })

        // save portal user to the database
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await portalUsersCollection.insertOne(user);
            res.json(result);
        })

        // uodate user if not existed
        app.put('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const result = await portalUsersCollection.updateOne(query, { $set: user }, { upsert: true });
            res.json(result);
        })

        // add admin roll to user
        app.put('/users/makeAdmin', verifyToken, async (req, res) => {
            const user = req.body;
            const requester = req.decodedEmail
            if (requester) {
                const requesterAccount = await portalUsersCollection.findOne({ email: requester });
                if (requesterAccount?.role === 'admin') {

                    const filter = { email: user.email };
                    const result = await portalUsersCollection.updateOne(filter, { $set: { role: 'admin' } });
                    res.json(result);
                }
            }
            else {
                res.status(403).json({message: 'Unauthorized'});
            }
        })

    }
    finally {
        // await client.close();
    }

}

run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello dcotors portal!')
})

app.listen(port, () => {
    console.log(`Doctors portal listening on port ${port}`)
})