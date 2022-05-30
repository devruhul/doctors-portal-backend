const express = require('express')
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express()
const cors = require('cors')
require('dotenv').config()
const port = process.env.PORT || 5000

// middleware
app.use(cors())

// Connection uri
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6jlv6.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
    }

    finally {
        await client.close();
    }

}

run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello dcotors portal!')
})

app.listen(port, () => {
    console.log(`Doctors portal listening on port ${port}`)
})