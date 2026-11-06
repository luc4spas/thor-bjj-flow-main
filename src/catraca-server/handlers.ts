import { WebSocket } from "ws";
import { insertCheckin } from "./db";

export async function handleMessage(ws: WebSocket, payload: any) {
  const { cmd, ret, result } = payload;

  // The turnstile sends `cmd` for requests.
  if (cmd) {
    switch (cmd) {
      case "reg":
        await handleRegister(ws, payload);
        break;
      case "sendlog":
        await handleSendLog(ws, payload);
        break;
      default:
        console.log(`Unhandled command from catraca: ${cmd}`);
    }
  } 
  // Responses from turnstile when server sends a command
  else if (ret) {
    console.log(`Received response for ${ret}: result=${result}`);
  }
}

async function handleRegister(ws: WebSocket, payload: any) {
  console.log(`Catraca registered: SN=${payload.sn}`);
  
  // Respond to the registration to keep the connection alive
  const response = {
    ret: "reg",
    result: true,
    cloudtime: new Date().toISOString().replace("T", " ").substring(0, 19),
    nosenduser: true // Tell device we don't have users to send right now
  };
  
  ws.send(JSON.stringify(response));
}

async function handleSendLog(ws: WebSocket, payload: any) {
  console.log(`Received logs from Catraca SN=${payload.sn}, count=${payload.count}`);
  
  if (payload.record && Array.isArray(payload.record)) {
    for (const record of payload.record) {
      const { enrollid, time } = record;
      
      // Call DB helper to insert log
      await insertCheckin(enrollid, time);
    }
  }

  // Acknowledge logs so the device clears them from memory
  const response = {
    ret: "sendlog",
    result: true,
    count: payload.count,
    logindex: payload.logindex,
    cloudtime: new Date().toISOString().replace("T", " ").substring(0, 19),
    access: 1, 
    message: "Acesso Liberado"
  };
  
  ws.send(JSON.stringify(response));
}

// Helper functions for sending commands to the device
export function getUserList(ws: WebSocket) {
  ws.send(JSON.stringify({ cmd: "getuserlist", stn: true }));
}

export function openDoor(ws: WebSocket) {
  ws.send(JSON.stringify({ cmd: "opendoor", doornum: 1 }));
}
