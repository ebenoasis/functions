const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const database = admin.firestore();

exports.handleScheduledTask = functions.https
    .onRequest(async (req, res) => {
      const {UID} = req.body;
      const docRef = database.collection("ADSGHANA").doc(UID);
      const doc = await docRef.get();
      if (!doc.exists) {
        console.log(`Document with UID ${UID} does not exist.`);
        res.status(404).send("Document not found.");
        return;
      }

      const {TimestampDeparture, PostStatus} = doc.data();
      const now = admin.firestore.Timestamp.now();
      if (now >= TimestampDeparture && PostStatus !== "Cancelled") {
        await docRef.update({PostStatus: "Started"});
        console.log(`Post with UID ${UID} has been started.`);
        res.status(200).send("Post started successfully.");
      } else {
        console.log(`Post with UID ${UID} is not ready to start.`);
        res.status(200).send("Post not ready to start yet.");
      }
    });

exports.createScheduledTask = functions.firestore.document("ADSGHANA/{UID}")
    .onCreate(async (snapshot, context) => {
      const data = snapshot.data();
      const {UID, TimestampDeparture} = data;
      const now = admin.firestore.Timestamp.now();
      if (now >= TimestampDeparture) {
        console.log(`Post with UID ${UID} should have already started.`);
        return null;
      }
      const project = JSON.parse(process.env.FIREBASE_CONFIG).projectId;
      const location = `us-central1`;
      const queue = "scheduleAds";
      const task = {
        httpRequest: {
          httpMethod: "POST",
          url: `https://${location}/${project}.cloudfunctions.net/handleScheduledTask?UID=${UID}`,
          body: Buffer.from(JSON.stringify({UID})).toString("base64"),
          headers: {
            "Content-Type": "application/json",
          },
        },
        scheduleTime: TimestampDeparture.toDate().toISOString(),

      };
      const {CloudTasksClient} = require("@google-cloud/tasks");
      const client = new CloudTasksClient();
      const parent = client.queuePath(project, location, queue);
      const [response] = await client.createTask({parent, task});
      console.log(`Created task ${response.name}`);
      return null;
    });
