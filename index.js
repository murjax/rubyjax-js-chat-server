const express = require('express');
const ws = require('ws');
const cors = require('cors');

const app = express();

app.use(cors());

const wsServer = new ws.Server({ noServer: true });

const subscriptions = {};

wsServer.on('connection', socket => {
  socket.on('message', data => {
    const json = JSON.parse(data);

    if (json.requestType == 'subscribe') {
      subscriptions[json.id] = subscriptions[json.id] || {
        channel_name: json.channel_name,
        subscribers: []
      };
      const subscribers = subscriptions[json.id].subscribers;
      subscribers.push(socket);
      subscriptions[json.id].subscribers = subscribers;
      const subscriptionConfirmation = JSON.stringify({
        id: json.id,
        channel_name: subscriptions[json.id].channel_name,
        requestType: 'subscriptionConfirmation'
      });
      const newBuffer = Buffer.from(subscriptionConfirmation, 'utf-8');
      socket.send(newBuffer);
    } else if (json.requestType == 'chatMessage') {
      subscriptions[json.channel].subscribers.forEach((subscriber) => {
        if (subscriber == socket) { return; }

        subscriber.send(data);
      });
    }
  });

  socket.on('close', () => {
    const channels = Object.keys(subscriptions);
    channels.forEach((channel) => {
      const index = subscriptions[channel].subscribers.indexOf(socket);
      if (index > -1) {
        subscriptions[channel].subscribers.splice(index, 1);

        if (!subscriptions[channel].subscribers.length) {
          delete subscriptions[channel];
        }
      }
    });

    console.log(subscriptions);
  });
});

const channelIndex = (request, response) => {
  const channelList = Object.keys(subscriptions).map((channel) => {
    return {
      id: channel,
      user_count: subscriptions[channel].subscribers.length,
      channel_name: subscriptions[channel].channel_name
    }
  });
  response.status(200).json(channelList);
}

app.get('/channels', channelIndex)
const server = app.listen(3001, () => {
  console.log('App running on port 3001.');
});

server.on('upgrade', (request, socket, head) => {
  wsServer.handleUpgrade(request, socket, head, socket => {
    wsServer.emit('connection', socket, request);
  });
});
