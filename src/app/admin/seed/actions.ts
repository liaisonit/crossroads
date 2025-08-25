"use server";

import { db } from "@/lib/firebase";
import { collectionsToSeed } from "@/lib/seed-data";
import { collection, getDocs, writeBatch, doc, setDoc } from "firebase/firestore";

async function seedCollection(
  collectionName: string, 
  data: any[],
  options: { addStatus?: boolean; joinRoleName?: boolean } = {}
) {
  const batch = writeBatch(db);
  const collectionRef = collection(db, collectionName);

  console.log(`Clearing existing documents in ${collectionName}...`);
  const querySnapshot = await getDocs(collectionRef);
  querySnapshot.forEach((doc) => {
    batch.delete(doc.ref);
  });
  console.log(`Cleared ${querySnapshot.size} documents.`);

  // Add new documents
  console.log(`Adding ${data.length} new documents to ${collectionName}...`);
  data.forEach((item) => {
    // Use the provided ID for the document, or let Firestore generate one
    const docRef = item.id ? doc(collectionRef, item.id) : doc(collectionRef);
    let dataToWrite = { ...item };
    
    // This is a special ID to link to the auth user's UID.
    // The actual UID will be set on the client during sign-up, but we seed the rest of the data.
    if(item.id.startsWith('AUTH_UID_')) {
        // We don't want to use this placeholder as the doc ID.
        // The signup flow will create the user with the real auth UID.
        // We will skip creating a doc with this placeholder ID.
        return;
    }
    
    if (options.addStatus) {
        dataToWrite.status = 'Ongoing';
        dataToWrite.foreman = '';
    }
    
    // If the id was used for the doc ref, don't store it in the document data
    if (item.id) {
        delete dataToWrite.id;
    }

    batch.set(docRef, dataToWrite);
  });

  await batch.commit();
  console.log("Batch commit successful.");
  return {
    collection: collectionName,
    count: data.length,
    status: "success",
  };
}

export async function seedDatabase() {
  console.log("Starting database seed...");
  const results = [];

  for (const { name, data, addStatus, joinRoleName } of collectionsToSeed) {
      if (data.length === 0) continue; // Don't try to seed collections with no initial data
      try {
          const result = await seedCollection(name, data, { addStatus, joinRoleName });
          console.log(`Successfully seeded ${result.count} documents into ${result.collection}`);
          results.push(result);
      } catch (error) {
          console.error(`Error seeding ${name}:`, error);
          results.push({ collection: name, status: "error", error: (error as Error).message });
      }
  }

  console.log("Database seeding finished.");
  return results;
}

export async function wipeCollections(collectionNames: string[]) {
    console.log("Starting database wipe for collections:", collectionNames);
    const results = [];

    for (const collectionName of collectionNames) {
        try {
            const collectionRef = collection(db, collectionName);
            const querySnapshot = await getDocs(collectionRef);
            
            if (querySnapshot.empty) {
                results.push({ collection: collectionName, count: 0, status: 'success' });
                continue;
            }
            
            const batch = writeBatch(db);
            querySnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            
            console.log(`Successfully wiped ${querySnapshot.size} documents from ${collectionName}`);
            results.push({ collection: collectionName, count: querySnapshot.size, status: 'success' });
        } catch(error) {
            console.error(`Error wiping ${collectionName}:`, error);
            results.push({ collection: collectionName, status: "error", error: (error as Error).message });
        }
    }
    
    console.log("Database wipe finished.");
    return results;
}

export async function backupDatabase() {
    console.log("Starting database backup...");
    const backupData: { [key: string]: any[] } = {};
    const collectionNames = collectionsToSeed.map(c => c.name);

    for (const collectionName of collectionNames) {
        try {
            const querySnapshot = await getDocs(collection(db, collectionName));
            backupData[collectionName] = querySnapshot.docs.map(doc => ({
                _id: doc.id,
                ...doc.data(),
            }));
            console.log(`Backed up ${querySnapshot.size} documents from ${collectionName}`);
        } catch (error) {
            console.error(`Error backing up ${collectionName}:`, error);
            throw new Error(`Failed to back up collection: ${collectionName}`);
        }
    }

    console.log("Database backup finished.");
    return backupData;
}


export async function restoreDatabase(backupData: string) {
    console.log("Starting database restore...");
    const data = JSON.parse(backupData);
    const collectionNames = Object.keys(data);

    // First, wipe all collections that are present in the backup.
    console.log("Wiping collections before restore...");
    await wipeCollections(collectionNames);
    console.log("Wiping complete.");

    const results = [];
    for (const collectionName of collectionNames) {
        const documents = data[collectionName];
        if (!Array.isArray(documents)) {
            console.warn(`Skipping ${collectionName}: not an array.`);
            continue;
        }

        try {
            const batch = writeBatch(db);
            const collectionRef = collection(db, collectionName);
            
            let count = 0;
            documents.forEach(item => {
                const { _id, ...itemData } = item;
                // Use the original ID from the backup
                const docRef = doc(collectionRef, _id);
                batch.set(docRef, itemData);
                count++;
            });
            
            await batch.commit();
            console.log(`Successfully restored ${count} documents to ${collectionName}`);
            results.push({ collection: collectionName, count, status: 'success' });
        } catch(error) {
            console.error(`Error restoring ${collectionName}:`, error);
            results.push({ collection: collectionName, count: 0, status: "error", error: (error as Error).message });
        }
    }
    
    console.log("Database restore finished.");
    return results;
}
