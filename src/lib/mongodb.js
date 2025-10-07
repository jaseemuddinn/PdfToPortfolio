import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const defaultDbName = process.env.MONGODB_DB;

if (!uri) {
    throw new Error(
        "Missing MONGODB_URI environment variable. Add it to your .env.local file."
    );
}

const options = {};

let client;
let clientPromise;

if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
        client = new MongoClient(uri, options);
        global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
} else {
    client = new MongoClient(uri, options);
    clientPromise = client.connect();
}

export { clientPromise };

export async function getDb(dbName = defaultDbName) {
    if (!dbName) {
        throw new Error(
            "Missing database name. Provide MONGODB_DB or pass a database name to getDb()."
        );
    }

    const client = await clientPromise;
    return client.db(dbName);
}
