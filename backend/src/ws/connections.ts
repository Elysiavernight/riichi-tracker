
const activeConnections = new Set<any>();

export function addConnection(socket: any) {
  activeConnections.add(socket);
}

export function removeConnection(socket: any) {
  activeConnections.delete(socket);
}

export function broadcast(message: object) {
  const payload = JSON.stringify(message);
  for (const socket of activeConnections) {
    if (socket.readyState === 1) socket.send(payload);
  }
}