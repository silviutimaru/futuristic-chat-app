console.log("Friends route loaded");
const express = require('express');
const router = express.Router();
const axios = require('axios');
const User = require('../models/User');
const Room = require('../models/Room');
const Message = require('../models/Message');

// Send a friend invitation
router.post('/invite', async (req, res) => {
  const { fromUserId, toUserId } = req.body;
  if (!fromUserId || !toUserId) {
    return res.status(400).json({ msg: 'Missing user IDs' });
  }
  if (fromUserId === toUserId) {
    return res.status(400).json({ msg: 'Cannot invite yourself' });
  }
  try {
    const toUser = await User.findById(toUserId);
    if (!toUser) return res.status(404).json({ msg: 'User not found' });
    if (toUser.pendingInvitations.includes(fromUserId)) {
      return res.status(400).json({ msg: 'Invitation already sent' });
    }
    if (toUser.friends.includes(fromUserId)) {
      return res.status(400).json({ msg: 'Already friends' });
    }
    toUser.pendingInvitations.push(fromUserId);
    await toUser.save();
    res.json({ msg: 'Invitation sent' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Accept a friend invitation
router.post('/accept', async (req, res) => {
  const { userId, fromUserId } = req.body;
  if (!userId || !fromUserId) {
    return res.status(400).json({ msg: 'Missing user IDs' });
  }
  try {
    const user = await User.findById(userId);
    const fromUser = await User.findById(fromUserId);
    if (!user || !fromUser) return res.status(404).json({ msg: 'User not found' });

    // Remove invitation
    user.pendingInvitations = user.pendingInvitations.filter(
      (id) => id.toString() !== fromUserId
    );
    // Add each other as friends
    if (!user.friends.includes(fromUserId)) user.friends.push(fromUserId);
    if (!fromUser.friends.includes(userId)) fromUser.friends.push(userId);

    await user.save();
    await fromUser.save();

    res.json({ msg: 'Friend added' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get a user's friends and pending invitations
router.get('/list/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate('friends', 'firstName lastName email')
      .populate('pendingInvitations', 'firstName lastName email');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json({
      friends: user.friends,
      pendingInvitations: user.pendingInvitations,
    });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Create a private room
router.post('/room', async (req, res) => {
  const { name, memberIds } = req.body;
  if (!name || !memberIds || !Array.isArray(memberIds) || memberIds.length < 2) {
    return res.status(400).json({ msg: 'Room name and at least 2 members required' });
  }
  try {
    const room = new Room({
      name,
      isPrivate: true,
      members: memberIds,
    });
    await room.save();

    // Add room to each user's privateRooms
    await User.updateMany(
      { _id: { $in: memberIds } },
      { $push: { privateRooms: room._id } }
    );

    res.json({ msg: 'Private room created', roomId: room._id });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get a user's private rooms
router.get('/rooms/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).populate({
      path: 'privateRooms',
      populate: { path: 'members', select: 'firstName lastName email language' }
    });
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json({ privateRooms: user.privateRooms });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Remove a friend
router.post('/remove', async (req, res) => {
  const { userId, friendId } = req.body;
  if (!userId || !friendId) {
    return res.status(400).json({ msg: 'Missing user IDs' });
  }
  try {
    // Remove friendId from user's friends
    await User.findByIdAndUpdate(userId, { $pull: { friends: friendId } });
    // Remove userId from friend's friends
    await User.findByIdAndUpdate(friendId, { $pull: { friends: userId } });
    res.json({ msg: 'Friend removed' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Save a message to the database, with translation
router.post('/room/message', async (req, res) => {
  const { roomId, sender, message, sentAt } = req.body;
  if (!roomId || !sender || !message) {
    return res.status(400).json({ msg: 'Missing data' });
  }
  try {
    // Find the room and its members
    const room = await Room.findById(roomId).populate('members');
    let translatedMessages = [];

    if (room && room.members && room.members.length > 0) {
      for (const member of room.members) {
        // Skip translation for the sender
        if (member.firstName + " " + member.lastName === sender) continue;

        // Use LibreTranslate API (free, no API key needed for demo)
        const targetLang = member.language || "en";
        let translatedText = message;
        if (targetLang !== "en") {
          try {
            const response = await axios.post('https://libretranslate.de/translate', {
              q: message,
              source: "en", // You can improve this by detecting the sender's language
              target: targetLang,
              format: "text"
            }, {
              headers: { 'accept': 'application/json', 'Content-Type': 'application/json' }
            });
            translatedText = response.data.translatedText;
          } catch (err) {
            translatedText = message;
          }
        }
        translatedMessages.push({
          roomId,
          sender,
          message: translatedText,
          sentAt: sentAt || new Date()
        });
      }
    }

    // Save the original message for the sender
    const newMessage = new Message({ roomId, sender, message, sentAt: sentAt || new Date() });
    await newMessage.save();

    // Save translated messages for other members
    for (const msg of translatedMessages) {
      await new Message(msg).save();
    }

    res.json({ msg: 'Message saved' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get chat history for a room
router.get('/room/messages/:roomId', async (req, res) => {
  try {
    const messages = await Message.find({ roomId: req.params.roomId }).sort({ sentAt: 1 });
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// TEMP: Get the General Room ID
router.get('/general-room-id', async (req, res) => {
  const Room = require('../models/Room');
  const generalRoom = await Room.findOne({ name: "General Room" });
  if (generalRoom) {
    res.json({ generalRoomId: generalRoom._id });
  } else {
    res.status(404).json({ msg: "General Room not found" });
  }
});

module.exports = router;