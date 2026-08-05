import { FStore } from "./firebase.js";

const { collection, doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch } = FStore;

class FirestoreFrame {
    listenerTerminators = new Set()
    constructor(collectionName) {
        this.collectionName = collectionName;
    }


    clearListeners() {
        for (const terminate of this.listenerTerminators) {
            terminate();
        }
        this.listenerTerminators = [];
    }


    onValue(id, callback, errorCallback) {
        const docRef = this.doc(id);
        const end = FStore.onSnapshot(docRef, {
            next: (docSnap) => {
                if (docSnap.exists()) {
                    callback(docSnap.data());
                } else {
                    callback(null);
                }
            },
            error: errorCallback
        });
        this.listenerTerminators.add(end);
        return () => {
            end();
            this.listenerTerminators.delete(end);
        }
    }   

    async onValuePromise(id, callback) {
        let end;
        await new Promise((resolve, reject) => {
            end = this.onValue(id, async (data) => {
                let value = callback(data);
                if (value instanceof Promise) { await value }
                resolve();
            }, reject);
        });
        return end;
    }

    doc(id) {
        return doc(collection(this.collectionName), id);
    }

    async get(id) {
        const docRef = this.doc(id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            return null;
        }
    }

    async set(id, data, options = { merge: false }) {
        const docRef = this.doc(id);
        await setDoc(docRef, data, options);
    }

    async update(id, data) {
        const docRef = this.doc(id);
        await updateDoc(docRef, data);
    }

    async delete(id) {
        const docRef = this.doc(id);
        await deleteDoc(docRef);
    }

    async batchUpdate(updates) {
        const batch = writeBatch();
        for (const [id, data] of Object.entries(updates)) {
            const docRef = this.doc(id);
            batch.update(docRef, data);
        }
        await batch.commit();
    }

    async batchSet(sets) {
        const batch = writeBatch();
        for (const [id, data] of Object.entries(sets)) {
            const docRef = this.doc(id);
            batch.set(docRef, data);
        }
        await batch.commit();
    }
}


export { FirestoreFrame };