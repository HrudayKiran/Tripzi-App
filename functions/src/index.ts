
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();

export const createGroupChatOnTripFull = functions.firestore
    .document("trips/{tripId}")
    .onUpdate(async (change, context) => {
      const tripData = change.after.data();
      const tripId = context.params.tripId;

      if (
        tripData.participants &&
        tripData.maxTravelers &&
        tripData.participants.length === tripData.maxTravelers
      ) {
        // The trip is full, create a group chat
        const chatRoomId = `trip_${tripId}`;

        // Check if the chat room already exists
        const chatRoomRef = db.collection("chats").doc(chatRoomId);
        const chatRoomSnap = await chatRoomRef.get();

        if (!chatRoomSnap.exists) {
          await chatRoomRef.set({
            participants: tripData.participants,
            tripId: tripId,
            isGroupChat: true,
            groupName: tripData.title,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`Group chat created for trip ${tripId}`);
        } else {
          console.log(`Group chat already exists for trip ${tripId}`);
        }
      }
    });
