/* eslint-disable react-hooks/exhaustive-deps */
import { ToastContainer } from "react-toastify";
import { useState, useEffect } from "react";

import logo from "./logo.svg";
import "./App.css";
import * as RxDB from "rxdb";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { schema } from "./Schema";

import { replicateCouchDB } from "rxdb/plugins/replication-couchdb";

import { RxDBLeaderElectionPlugin } from "rxdb/plugins/leader-election";
RxDB.addRxPlugin(RxDBLeaderElectionPlugin);

function App() {
  const syncURL = "http://localhost:5984/";
  const dbName = "assembly";
  let dbPromise = null;

  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const subs = [];

  const createDB = async () => {
    const db = await RxDB.createRxDatabase({
      name: dbName,
      storage: getRxStorageDexie(),
      eventReduce: true,
      ignoreDuplicate: true,
    });
    db.waitForLeadership().then(() => {
      document.title = "♛ " + document.title;
    });

    await db.addCollections({
      baskets: {
        schema: schema,
      },
    });
    db.collections.baskets.preInsert((docObj) => {
      const { basket } = docObj;
      return db.collections.baskets
        .findOne({
          selector: { basket },
        })
        .exec()
        .then((has) => {
          if (has !== null) {
            console.error("another hero already has the color " + basket);
            throw new Error("color already there");
          }
          return db;
        });
    });

    // sync
    await Promise.all(
      Object.values(db.collections).map(async (col) => {
        try {
          // create the CouchDB database
          await fetch(syncURL + col.name + "/", {
            method: "PUT",
          });
        } catch (err) {
        }
      })
    );
    Object.values(db.collections)
      .map((col) => col.name)
      .map((colName) => {
        const url = syncURL + colName + "/";
        const replicationState = replicateCouchDB({
          collection: db[colName],
          url,
          live: true,
          pull: {},
          push: {},
          autoStart: true,
        });
        replicationState.error$.subscribe((err) => {
        });
      });

    return db;
  };

  const get = () => {
    if (!dbPromise) dbPromise = createDB();
    return dbPromise;
  };

  useEffect(() => {
    const create = async () => {
      const db = await get();
      const sub = db.baskets
        .find({
          selector: {},
          sort: [{ basket: "asc" }],
        })
        .$.subscribe((baskets) => {
          if (!baskets) {
            return;
          }
          setMessages(baskets);
        });
      subs.push(sub);
    };
    create();
  }, []);

  const addMessage = async () => {
    const db = await get();
    const payload = {
      basket: "R48",
    };
 await db.baskets.insert(payload);
  };
console.log(messages);
  return (
    <div className="App">
      <ToastContainer autoClose={3000} />

      <div className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <h2>Welcome to React</h2>
      </div>

      <div
        onClick={addMessage}
        id="add-message-div"
      >
        <h3>Add Message</h3>
      </div>
    </div>
  );
}

export default App;
