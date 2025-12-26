import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {db} from "./database";

setGlobalOptions({maxInstances: 10});

interface Trip {
  id: string;
  [key: string]: any;
}

export const getTrips = onRequest(async (request, response) => {
  logger.info("Starting getTrips function.", {structuredData: true});

  try {
    const tripsSnapshot = await db.collection("trips").get();
    const trips: Trip[] = [];
    tripsSnapshot.forEach((doc) => {
      trips.push({id: doc.id, ...doc.data()});
    });

    response.json({trips});
  } catch (error) {
    logger.error("Error getting trips:", error);
    response.status(500).send("Internal Server Error");
  }
});

export const createTrip = onRequest(async (request, response) => {
  logger.info("Starting createTrip function.", {structuredData: true});
  if (request.method !== "POST") {
    response.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const tripData = request.body;
    const docRef = await db.collection("trips").add(tripData);
    response.status(201).json({id: docRef.id, ...tripData});
  } catch (error) {
    logger.error("Error creating trip:", error);
    response.status(500).send("Internal Server Error");
  }
});
