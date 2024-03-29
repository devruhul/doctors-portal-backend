const express = require('express')
const app = express()
require('dotenv').config()
const admin = require("firebase-admin");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000
const stripe = require('stripe')(process.env.STRIPE_SECRET);
const fileUpload = require('express-fileupload');
const cors = require('cors');


// initialize firebase admin
admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL
});

// middleware
app.use(cors())
app.use(express.json())
app.use(fileUpload());

// Connection uri
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6jlv6.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });



// Verify token
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
        const doctorsCollection = database.collection('doctors')

        // send appointment info to the server
        app.post('/appointments', async (req, res) => {
            const appointment = req.body;
            const result = await appointmentsCollection.insertOne(appointment);
            res.json(result);
        })

        // get appointments information
        app.get('/appointments', async (req, res) => {
            const email = req.query.email;
            const date = req.query.date;
            const query = { email: email, date: date };
            const appointments = await appointmentsCollection.find(query).toArray();
            res.json(appointments);
        })

        // get all appointments by id
        app.get('/appointments/:id', async (req, res) => {
            const id = req.params.id;
            const appointment = await appointmentsCollection.findOne({ _id: ObjectId(id) });
            res.json(appointment);
        })

        // update appointment by id
        app.put('/appointments/:id', async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updateDoc = {
                $set: {
                    payment: payment
                }
            };
            const result = await appointmentsCollection.updateOne(filter, updateDoc);
            res.json(result);
        });

        // send doctor image to database
        app.post('/doctors', async (req, res) => {
            const doctorName = req.body.doctorName
            const doctorEmail = req.body.email
            const doctorImage = req.files.doctorImage
            const doctorImageData = doctorImage.data
            const encodedPic = doctorImageData.toString('base64')
            const imageBuffer = Buffer.from(encodedPic, 'base64')
            const doctor = {
                doctorName: doctorName,
                doctorEmail: doctorEmail,
                doctorImage: imageBuffer
            }
            const result = await doctorsCollection.insertOne(doctor);
            res.json(result);
        })

        // get all doctors
        app.get('/doctors', async (req, res) => {
            const doctors = await doctorsCollection.find().toArray();
            res.json(doctors);
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
                res.status(403).json({ message: 'Unauthorized' });
            }
        })

        // stripe payment
        app.post("/create-payment-intent", async (req, res) => {
            const paymentInfo = req.body;
            const amount = paymentInfo.price * 100

            // Create a PaymentIntent with the order amount and currency
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"]
            });

            res.json({ clientSecret: paymentIntent.client_secret });
        });

    }

    finally {
        // await client.close();
    }
}

run().catch(console.dir);

// Server root get request
app.get('/', (req, res) => {
    res.send('Hello doctors portal!')
})

// Listening the server
app.listen(port, () => {
    console.log(`Doctors portal listening on port ${port}`)
})